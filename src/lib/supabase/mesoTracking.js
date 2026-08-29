import { parseMaSetValue, parseMesoAmount } from '$lib/utils/parseMaSetValue';
import { getKstDateString } from '$lib/utils/parseAdena';

function increaseOnlyDelta(prevMeso, newMeso) {
	if (prevMeso === null || prevMeso === undefined) return 0;
	const net = (Number(newMeso) || 0) - (Number(prevMeso) || 0);
	return net > 0 ? net : 0;
}

/**
 * ma set_value_1 저장 후 보유메소 증가분만 adena_daily 에 누적
 * - 기록이 없으면 기준점만 잡고 획득 0
 * - 이후(날짜가 바뀌어도) max(0, 이번 - 직전) 만 오늘 획득에 합산
 */
export async function recordMesoEarnedFromSetValue1(supabase, email, setValue1Text) {
	const parsed = parseMaSetValue(setValue1Text);
	const meso = parseMesoAmount(parsed.meso);
	if (meso === null) {
		return { ok: true, skipped: true };
	}

	const { data: prev, error: prevError } = await supabase
		.from('adena_snapshots')
		.select('storage_adena, held_adena')
		.eq('email', email)
		.order('recorded_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (prevError) {
		console.error('meso snapshot prev lookup error:', prevError);
		return { ok: false, error: prevError.message };
	}

	const prevMeso = prev ? Number(prev.held_adena ?? prev.storage_adena ?? 0) : null;
	if (prev && prevMeso === meso) {
		return { ok: true, inserted: false, meso };
	}

	const { error: insertError } = await supabase.from('adena_snapshots').insert([
		{
			email,
			storage_adena: meso,
			held_adena: meso,
			total_adena: meso
		}
	]);

	if (insertError) {
		console.error('meso snapshot insert error:', insertError);
		return { ok: false, error: insertError.message, meso };
	}

	const dailyResult = await incrementMesoDailyForToday(supabase, email, meso, prevMeso);
	if (!dailyResult.ok) {
		return { ...dailyResult, meso };
	}

	return { ok: true, inserted: true, meso, daily: dailyResult.summary };
}

async function incrementMesoDailyForToday(
	supabase,
	email,
	newMeso,
	prevMeso,
	statDate = getKstDateString()
) {
	const meso = Number(newMeso) || 0;
	const delta = increaseOnlyDelta(prevMeso, meso);

	const { data: existing, error: fetchError } = await supabase
		.from('adena_daily')
		.select('earned_total, start_total, end_total, max_total, snapshot_count')
		.eq('email', email)
		.eq('stat_date', statDate)
		.maybeSingle();

	if (fetchError) {
		console.error('meso daily fetch error:', fetchError);
		return { ok: false, error: fetchError.message };
	}

	const summary = existing
		? {
				start_total: existing.start_total ?? 0,
				end_total: meso,
				max_total: Math.max(Number(existing.max_total) || 0, meso),
				earned_total: (Number(existing.earned_total) || 0) + delta,
				snapshot_count: (Number(existing.snapshot_count) || 0) + 1
			}
		: {
				start_total: meso,
				end_total: meso,
				max_total: meso,
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
		console.error('meso daily upsert error:', upsertError);
		return { ok: false, error: upsertError.message };
	}

	return { ok: true, summary };
}
