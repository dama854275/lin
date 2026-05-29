const DEFAULT_PAGE_SIZE = 1000;

/**
 * Supabase API max-rows(기본 1000) 제한을 우회해 전체 행을 조회합니다.
 * buildQuery는 매 페이지마다 새 쿼리 빌더를 반환해야 하며, .order()를 포함해야 합니다.
 *
 * @param {() => { range: (from: number, to: number) => Promise<{ data: unknown[] | null; error: unknown }> }} buildQuery
 * @param {{ pageSize?: number }} [options]
 */
export async function fetchAllRows(buildQuery, { pageSize = DEFAULT_PAGE_SIZE } = {}) {
	const all = [];
	let offset = 0;

	while (true) {
		const { data, error } = await buildQuery().range(offset, offset + pageSize - 1);

		if (error) {
			return { data: null, error };
		}

		const rows = data ?? [];
		all.push(...rows);

		if (rows.length < pageSize) {
			break;
		}

		offset += pageSize;
	}

	return { data: all, error: null };
}
