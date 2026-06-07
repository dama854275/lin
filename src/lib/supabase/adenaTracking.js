import {
	extractAdenaFromSetValue1,
	getKstDateString,
	hasAdenaChanged,
	calculateStorageIncreaseDelta
} from '$lib/utils/parseAdena';

/** set_value_1 저장 후 스냅샷 + 일별 누적 갱신 */
export async function recordAdenaSnapshotFromSetValue1(supabase, email, setValue1Text) {
	const adena = extractAdenaFromSetValue1(setValue1Text);

	const { data: prev, error: prevError } = await supabase
		.from('adena_snapshots')
		.select('storage_adena, held_adena, total_adena')
		.eq('email', email)
		.order('recorded_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (prevError) {
		console.error('adena snapshot prev lookup error:', prevError);
		return { ok: false, error: prevError.message };
	}

	if (!hasAdenaChanged(prev, adena)) {
		return { ok: true, inserted: false, adena };
	}

	const prevStorage = prev ? (prev.storage_adena ?? 0) : null;

	const { error: insertError } = await supabase.from('adena_snapshots').insert([
		{
			email,
			storage_adena: adena.storage,
			held_adena: adena.held,
			total_adena: adena.total
		}
	]);

	if (insertError) {
		console.error('adena snapshot insert error:', insertError);
		return { ok: false, error: insertError.message, adena };
	}

	const dailyResult = await incrementAdenaDailyForToday(supabase, email, adena.storage, prevStorage);
	if (!dailyResult.ok) {
		return { ...dailyResult, adena };
	}

	return { ok: true, inserted: true, adena, daily: dailyResult.summary };
}

/**
 * API로 보관값이 들어올 때마다 당일 earned_total 누적
 * - 당일 최초: API 보관값 그대로 누적 (전날 기록과 비교 안 함)
 * - 당일 2회차 이후: max(0, 이번 보관 - 직전 보관) 누적
 */
export async function incrementAdenaDailyForToday(
	supabase,
	email,
	newStorage,
	prevStorage,
	statDate = getKstDateString()
) {
	const storage = Number(newStorage) || 0;

	const { data: existing, error: fetchError } = await supabase
		.from('adena_daily')
		.select('earned_total, start_total, end_total, max_total, snapshot_count')
		.eq('email', email)
		.eq('stat_date', statDate)
		.maybeSingle();

	if (fetchError) {
		console.error('adena daily fetch error:', fetchError);
		return { ok: false, error: fetchError.message };
	}

	const isFirstToday = !existing;
	const delta = isFirstToday ? storage : calculateStorageIncreaseDelta(prevStorage, newStorage);

	const summary = existing
		? {
				start_total: existing.start_total ?? 0,
				end_total: storage,
				max_total: Math.max(Number(existing.max_total) || 0, storage),
				earned_total: (Number(existing.earned_total) || 0) + delta,
				snapshot_count: (Number(existing.snapshot_count) || 0) + 1
			}
		: {
				start_total: storage,
				end_total: storage,
				max_total: storage,
				earned_total: delta,
				snapshot_count: 1
			};

	const { error: upsertError } = await supabase.from('adena_daily').upsert(
		{
			email,
			stat_date: statDate,
			earned_total: summary.earned_total,
			start_total: summary.start_total,
			end_total: summary.end_total,
			max_total: summary.max_total,
			snapshot_count: summary.snapshot_count,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'email,stat_date' }
	);

	if (upsertError) {
		console.error('adena daily upsert error:', upsertError);
		return { ok: false, error: upsertError.message };
	}

	return { ok: true, summary };
}