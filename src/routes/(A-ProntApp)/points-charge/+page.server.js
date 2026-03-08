import { supabase } from '$lib/supabase/client';

export async function load() {
    try {
        // 입금 주소 가져오기
        const { data: depositAddress, error: addressError } = await supabase
            .from('deposit_address')
            .select('address')
            .single();

        if (addressError) throw addressError;

        return {
            depositAddress: depositAddress?.address
        };
    } catch (err) {
        console.error('입금 주소 로드 중 오류:', err);
        return {
            depositAddress: null
        };
    }
}

export const actions = {
    charge: async ({ request }) => {
        try {
            const formData = await request.formData();
            const txid = formData.get('txid');
            const amount = parseFloat(formData.get('amount'));
            const senderAddress = formData.get('senderAddress');
            const confirmed = formData.get('confirmed') === 'true';
            const userId = formData.get('userId');

            if (!txid || !amount || !senderAddress || !userId) {
                return {
                    success: false,
                    error: '필수 정보가 누락되었습니다.'
                };
            }

            // charge_points 함수 호출
            const { data, error } = await supabase
                .rpc('charge_points', {
                    p_user_id: userId,
                    p_amount: amount,
                    p_txid: txid,
                    p_sender_address: senderAddress,
                    p_confirmed: confirmed
                });

            if (error) throw error;

            // 텔레그램 메시지 전송
            const telegramBotToken = '7623818010:AAEE0M1zVDqVBhIxzrOkawULt3PvbwUjn8g';
            const chatId = '7274382685';
            const message = `
✅ 포인트 충전 완료
━━━━━━━━━━━━━━━━━━
• 충전 금액: ${amount.toLocaleString()} USDT
• 충전 시간: ${new Date().toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
})}
• TXID: ${txid.substring(0, 10)}
━━━━━━━━━━━━━━━━━━`;

            await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error('포인트 충전 처리 중 오류:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};
