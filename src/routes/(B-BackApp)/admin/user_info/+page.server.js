import { supabaseServer } from '$lib/supabase/server';

export const load = async () => {
    try {
        // 먼저 샘플 사용자를 조회하여 product_ 컬럼들을 찾습니다
        const { data: sampleUser, error: sampleError } = await supabaseServer
            .from('user_info')
            .select('*')
            .limit(1)
            .single();

        if (sampleError) {
            console.error('샘플 데이터 로드 오류:', sampleError);
            return { 
                userInfos: [],
                error: '테이블 정보를 불러오는데 실패했습니다.'
            };
        }

        // product_ 로 시작하는 컬럼들을 찾습니다
        const productColumns = Object.keys(sampleUser)
            .filter(key => key.startsWith('product_'));

        // 사용자 정보를 조회합니다
        const { data: userInfos, error: userError } = await supabaseServer
            .from('user_info')
            .select(`
                user_id,
                referrer_id,
                email,
                points,
                created_at,
                ${productColumns.join(', ')}
            `);

        if (userError) {
            console.error('사용자 정보 조회 오류:', userError);
            return { 
                userInfos: [],
                error: '사용자 정보를 불러오는데 실패했습니다.'
            };
        }

        // 추천인 이메일 정보를 가져옵니다
        const referrerIds = userInfos
            .map(user => user.referrer_id)
            .filter(id => id); // null/undefined 제거

        const { data: referrerEmails, error: referrerError } = await supabaseServer
            .from('user_info')
            .select('user_id, email')
            .in('user_id', referrerIds);

        if (referrerError) {
            console.error('추천인 정보 조회 오류:', referrerError);
            // 추천인 정보가 없어도 계속 진행
        }

        // contacts 데이터 조회 수정
        const { data: contacts, error: contactsError } = await supabaseServer
            .from('contacts')
            .select(`
                id,
                created_at,
                user_id,
                user_email,
                title,
                status
            `)
            .order('created_at', { ascending: false });

        if (contactsError) {
            console.error('Contacts 조회 오류:', contactsError);
            // contacts 정보가 없어도 계속 진행
        }

        // transaction_history 데이터 조회 추가
        const { data: transactions, error: transactionsError } = await supabaseServer
            .from('transaction_history')
            .select('*')
            .order('created_at', { ascending: false });

        if (transactionsError) {
            console.error('Transactions 조회 오류:', transactionsError);
            // transactions 정보가 없어도 계속 진행
        }

        // 데이터 결합 수정
        const enrichedUserInfos = (userInfos || []).map(user => {
            // user_email 또는 user_id로 매칭
            const userContacts = (contacts || []).filter(contact => {
                const matchByEmail = contact.user_email?.toLowerCase() === user.email?.toLowerCase();
                const matchById = contact.user_id === user.user_id;
                
                // 디버깅을 위한 로그
                // console.log('문의 매칭 확인:', {
                //     contactEmail: contact.user_email,
                //     userEmail: user.email,
                //     contactUserId: contact.user_id,
                //     userId: user.user_id,
                //     matchByEmail,
                //     matchById
                // });

                return matchByEmail || matchById;
            });

            // 디버깅을 위한 로그
            // console.log(`사용자 ${user.email}의 매칭된 문의:`, userContacts);

            // 사용자의 충전 내역 필터링
            const userTransactions = (transactions || []).filter(tx => tx.user_id === user.user_id);

            return {
                ...user,
                referrer_email: referrerEmails?.find(ref => ref.user_id === user.referrer_id)?.email || '-',
                contacts: userContacts.map(contact => ({
                    id: contact.id,
                    title: contact.title,
                    created_at: contact.created_at,
                    status: contact.status || 'pending'
                })),
                transactions: userTransactions // 충전 내역 추가
            };
        });

        return {
            userInfos: enrichedUserInfos
        };
    } catch (err) {
        console.error('사용자 정보 조회 오류:', err);
        return {
            userInfos: []
        };
    }
};