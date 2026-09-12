const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_MAX_PAGES = 10;

/**
 * Supabase API max-rows(기본 1000) 제한을 우회해 행을 조회합니다.
 * buildQuery는 매 페이지마다 새 쿼리 빌더를 반환해야 하며, .order()를 포함해야 합니다.
 * 같은 페이지가 반복되거나 maxPages에 도달하면 즉시 중단합니다.
 *
 * @param {() => { range: (from: number, to: number) => Promise<{ data: unknown[] | null; error: unknown }> }} buildQuery
 * @param {{ pageSize?: number; maxPages?: number }} [options]
 */
export async function fetchAllRows(
	buildQuery,
	{ pageSize = DEFAULT_PAGE_SIZE, maxPages = DEFAULT_MAX_PAGES } = {}
) {
	const safePageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
	const safeMaxPages = Math.max(1, Number(maxPages) || DEFAULT_MAX_PAGES);
	const all = [];
	let offset = 0;
	let prevIdentity = '';

	for (let page = 0; page < safeMaxPages; page += 1) {
		const { data, error } = await buildQuery().range(offset, offset + safePageSize - 1);

		if (error) {
			return { data: null, error, truncated: false };
		}

		const rows = data ?? [];
		if (rows.length === 0) {
			return { data: all, error: null, truncated: false };
		}

		if (rows.length === safePageSize) {
			const identity = pageIdentity(rows);
			if (identity && identity === prevIdentity) {
				return {
					data: all,
					error: { message: '목록 조회가 같은 페이지를 반복했습니다.', code: 'PAGINATION_STUCK' },
					truncated: false
				};
			}
			prevIdentity = identity;
		}

		all.push(...rows);

		if (rows.length < safePageSize) {
			return { data: all, error: null, truncated: false };
		}

		offset += safePageSize;
	}

	return { data: all, error: null, truncated: true };
}

function pageIdentity(rows) {
	const first = rowIdentity(rows[0]);
	const last = rowIdentity(rows[rows.length - 1]);
	if (!first && !last) return '';
	return `${first}|${last}`;
}

function rowIdentity(row) {
	if (!row || typeof row !== 'object') return '';
	if (row.email != null && String(row.email).trim() !== '') {
		return `email:${String(row.email).trim().toLowerCase()}`;
	}
	if (row.id != null) return `id:${row.id}`;
	return '';
}
