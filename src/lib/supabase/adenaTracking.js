import {
	extractAdenaFromSetValue1,
	getKstDateString,
	getKstDayBounds,
	hasAdenaChanged,
	summarizeSnapshots
} from '$lib/utils/parseAdena';

/** set_value_1 저장 후 스냅샷 + 일별 집계 갱신 */
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
		// 값이 동일하면 insert는 생략하지만, 디버깅을 위해 계산값은 반환
		return { ok: true, inserted: false, adena };
	}

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

	const dailyResult = await upsertAdenaDailyForToday(supabase, email);
	if (!dailyResult.ok) {
		return { ...dailyResult, adena };
	}

	return { ok: true, inserted: true, adena, daily: dailyResult.summary };
}

/** 오늘(KST) 스냅샷으로 adena_daily upsert */
export async function upsertAdenaDailyForToday(supabase, email, statDate = getKstDateString()) {
	const { start, end } = getKstDayBounds(statDate);

	const { data: snapshots, error: snapError } = await supabase
		.from('adena_snapshots')
		.select('storage_adena, held_adena, total_adena, recorded_at')
		.eq('email', email)
		.gte('recorded_at', start)
		.lte('recorded_at', end)
		.order('recorded_at', { ascending: true });

	if (snapError) {
		console.error('adena daily snapshot fetch error:', snapError);
		return { ok: false, error: snapError.message };
	}

	const summary = summarizeSnapshots(snapshots || []);

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
