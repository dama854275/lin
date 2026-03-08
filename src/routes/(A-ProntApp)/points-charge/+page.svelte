<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase/client'
    import { user } from '$lib/stores/auth'
    import { points } from '$lib/stores/points'

    let txid = '' // txid 입력값 저장
    let validReceiverAddress = '';
    
    onMount(async () => {
        // 입금 주소 가져오기
        const { data, error } = await supabase
            .from('deposit_address')
            .select('address')
            .single();
            
        if (data) {
            validReceiverAddress = data.address;
        } else {
            // console.error('입금 주소를 가져오는데 실패했습니다:', error);
        }
    });

    async function requestCharge() {
        if (!txid.trim()) {
            alert('거래번호(TxID)를 입력해주세요.')
            return
        }

        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            if (!currentUser) {
                alert('로그인이 필요합니다.')
                return
            }

            // TXID 중복 체크
            const { data: existingTransaction, error: txCheckError } = await supabase
                .from('transaction_history')
                .select('id')
                .eq('txid', txid.trim())
                .maybeSingle()

            if (txCheckError) {
                // console.error('TXID 조회 중 오류:', txCheckError)
                return
            }

            if (existingTransaction) {
                alert('이미 충전이 완료된 TXID 입니다.\nTXID를 다시 확인해주세요.')
                return
            }

            // TRON API 호출
            try {
                const response = await fetch(`https://apilist.tronscanapi.com/api/transaction-info?hash=${txid.trim()}`)
                const txData = await response.json()
                
                // USDT 전송 정보 추출
                const trc20Transfer = txData.trc20TransferInfo?.[0] || {}
                const amount = parseFloat(trc20Transfer.amount_str) / Math.pow(10, trc20Transfer.decimals || 6)
                
               
                // 거래 성공 여부 확인
                if (!txData.confirmed) {
                    alert('⚠️ TXID 정보가 잘못되었습니다.\n전송이 완료된 거래만 충전 신청이 가능합니다.\n\n📢 TXID 정보가 올바르다면 현재 USDT 전송이 진행되는 중일 수 있습니다.\n\nTXID를 다시 확인하거나 잠시 후 전송이 완료되면 다시 시도해주세요.')
                    return
                }

                // 받는 주소 확인
                if (trc20Transfer.to_address !== validReceiverAddress) {
                    alert('❌ 받는 주소가 다른 거래입니다.\n지정된 주소로 전송한 거래만 충전 신청이 가능합니다.')
                    return
                }

                // 거래 시간 체크
                const transactionDate = new Date(txData.timestamp)
                const validStartDate = new Date('2025-01-10T00:00:00+09:00') // 한국 시간 기준

                if (transactionDate < validStartDate) {
                    alert('❌ TXID가 만료되었습니다.')
                    return
                }
                
                 // 10,000 USDT 초과 체크
                 if (amount > 10000) {
                    alert('⚠️ 10,000 달러 이상의 거래가 감지 되었습니다.\n1:1문의에 글을 작성해주시기 바랍니다.')
                    return
                }

                
                // API 응답 데이터를 보기 좋게 포맷팅
                const timestamp = transactionDate.toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                })
                
                // • 거래 완료 시간: ${timestamp}
                const formattedInfo = `
거래 정보 확인
━━━━━━━━━━━━━━━━━━━━━━━━
• 거래 성공 여부: ${txData.confirmed ? '✅ 성공' : '❌ 실패'}
• 보낸 주소: ${trc20Transfer.from_address || '정보 없음'}
• USDT 수량: ${amount.toLocaleString()} USDT
━━━━━━━━━━━━━━━━━━━━━━━━

거래가 확인되었습니다.
충전 신청을 계속하시겠습니까?`.trim()

                // 거래 정보 확인 팝업
                if (confirm(formattedInfo)) {
                    try {
                        // FormData 생성
                        const formData = new FormData();
                        formData.append('txid', txid);
                        formData.append('amount', amount.toString());
                        formData.append('senderAddress', trc20Transfer.from_address);
                        formData.append('confirmed', txData.confirmed.toString());
                        formData.append('userId', currentUser.id);

                        // 서버 액션 호출
                        const response = await fetch('?/charge', {
                            method: 'POST',
                            body: formData
                        });

                        // 응답 상태 확인
                        if (!response.ok) {
                            const errorText = await response.text();
                            // console.error('서버 응답 에러:', errorText);
                            throw new Error(`서버 오류가 발생했습니다. (${response.status})`);
                        }

                        // 응답 데이터 파싱
                        const result = await response.json();
                        // console.log('서버 응답:', result); // 디버깅용 로그

                        // data 문자열을 JSON으로 파싱
                        const parsedData = JSON.parse(result.data);
                        // console.log('파싱된 데이터:', parsedData); // 디버깅용 로그

                        // 성공 여부 확인 (첫 번째 요소의 success 값 확인)
                        if (!parsedData[0]?.success) {
                            throw new Error('포인트 충전에 실패했습니다.');
                        }

                        // 포인트 데이터 확인 (마지막 두 요소)
                        const newPoints = parsedData[3];
                        const addedPoints = parsedData[4];

                        if (typeof newPoints !== 'number' || typeof addedPoints !== 'number') {
                            // console.error('잘못된 포인트 데이터:', { newPoints, addedPoints });
                            throw new Error('포인트 데이터가 올바르지 않습니다.');
                        }

                        // 성공 메시지 표시
                        alert(`${addedPoints.toLocaleString()} 포인트가 충전되었습니다.\n현재 포인트: ${newPoints.toLocaleString()}P`);
                        
                        // points store 업데이트
                        await points.fetch();
                        
                        // 입력 필드 초기화
                        txid = '';
                    } catch (error) {
                        // console.error('포인트 충전 중 오류 발생:', error);
                        alert(error.message || '포인트 충전에 실패했습니다. 관리자에게 문의해주세요.');
                    }
                }
                
            } catch (apiError) {
                // console.error('TRON API 호출 오류:', apiError)
                alert('트랜잭션 정보를 가져오는데 실패했습니다.')
            }
            
        } catch (error) {
            // console.error('충전 신청 중 오류:', error)
            alert('충전 신청에 실패했습니다.')
        }
    }
</script>

<svelte:head>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</svelte:head>

<div class="page-layout">
    <div class="main-content">
        <div class="container mx-auto p-4 max-w-6xl">
            <div class="tamagotchi-card">
                <div class="tamagotchi-screen">
                    <!-- Header Section -->
                    <div class="text-center mb-12">
                        <h1 class="text-3xl font-bold text-gray-800 tracking-tight flex items-center justify-center gap-2">
                            포인트 충전
                            <i class="fab fa-bitcoin text-gray-800"></i>
                        </h1>
                    </div>

            <!-- Points Display Section -->
            <div class="points-display mb-6 flex items-center justify-between w-full">
                <div class="flex items-center gap-2">
                    <h2 class="text-lg font-semibold text-gray-700">보유 포인트:</h2>
                    <p class="text-3xl font-bold text-blue-500">{$points?.toLocaleString() ?? 0}P</p>
                </div>
            </div>

            <!-- Deposit Address Section -->
            <div class="deposit-section mb-16 w-full">
                <h2 class="text-lg font-semibold text-gray-700 mb-4">USDT 입금 주소</h2>
                <div class="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                    <div class="relative">
                        {#if $user}
                            <input 
                                type="text" 
                                id="deposit-address" 
                                name="deposit-address"
                                value={validReceiverAddress} 
                                readonly 
                                class="w-full bg-white px-4 py-3 border-2 border-blue-300 rounded-lg pr-12 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <button 
                                class="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-400 text-white rounded-md hover:bg-blue-500 transition-colors text-sm"
                                on:click={() => {
                                    navigator.clipboard.writeText(validReceiverAddress);
                                    alert('주소가 복사되었습니다.');
                                }}
                            >
                                복사
                            </button>
                        {:else}
                            <div class="w-full bg-white px-4 py-3 border-2 border-blue-300 rounded-lg text-center text-gray-600">
                                로그인을 해야 입금 주소가 출력됩니다
                            </div>
                        {/if}
                    </div>
                    <div class="mt-4 flex flex-col gap-4">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-medium">입금 네트워크:</span>
                            <div class="flex gap-2">
                                <div class="bg-green-500 text-white px-3 py-1 rounded-md text-sm font-medium border-2 border-green-600">TRC20</div>
                                <div class="bg-green-500 text-white px-3 py-1 rounded-md text-sm font-medium border-2 border-green-600">TRON</div>
                                <div class="bg-green-500 text-white px-3 py-1 rounded-md text-sm font-medium border-2 border-green-600">트론</div>
                            </div>
                        </div>
                        <p class="text-sm text-red-500 flex items-center">
                            네트워크 주소를 반드시 확인하세요.
                        </p>
                        {#if !$user}
                            <p class="text-sm text-gray-600 flex items-center whitespace-nowrap">
                                <span class="mr-1">ℹ️</span>
                                입금주소는 로그인 한 상태에서만 확인 가능합니다.
                            </p>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Transaction Verification Section -->
            <div class="transaction-section w-full">
                <h2 class="text-lg font-semibold text-gray-700 mb-4">USDT 입금 확인</h2>
                <div class="space-y-4">
                    <div class="relative">
                        <input 
                            type="text" 
                            id="txid"
                            bind:value={txid}
                            placeholder="거래번호[ TXID ]를 입력하세요"
                            class="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono text-sm"
                        />
                    </div>
                    <div class="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                        <div class="flex flex-wrap gap-4">
                            <p class="text-sm text-gray-600 flex items-center whitespace-nowrap">
                                <span class="mr-1">💡</span>
                                입금하신 USDT*1000만큼 포인트가 충전됩니다 (1 USDT = 1,000 포인트)
                            </p>
                            <p class="text-sm text-red-500 flex items-center whitespace-nowrap">
                                <span class="mr-1">⚠️</span>
                                TXID가 조회되더라도 전송이 진행 중일때는 충전 신청이 불가능합니다.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Charge Request Button -->
                <div class="mt-6">
                    <button 
                        class="w-full btn-primary"
                        on:click={requestCharge}
                    >
                        <span>충전 신청하기</span>
                    </button>
                </div>
            </div>
                </div>
                <div class="tamagotchi-buttons">
                    <div class="button"></div>
                    <div class="button"></div>
                    <div class="button"></div>
                </div>
            </div>
        </div>
    </div>
    
    
</div>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
    
    :global(body) {
        font-family: 'Noto Sans KR', sans-serif;
    }

    /* 다마고치 스타일 카드 */
    .tamagotchi-card {
        position: relative;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        background-color: #c5d3f8;
        border-radius: 50px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
        transition: all 0.3s;
        border: 8px solid #92aff8;
    }

    .tamagotchi-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }

    .tamagotchi-screen {
        width: 95%;
        background-image: radial-gradient(#e0e0e0 1px, transparent 1px);
        background-size: 10px 10px;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 10px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        margin-bottom: 15px;
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
        border: 3px solid #dddddd;
    }

    .tamagotchi-buttons {
        display: flex;
        gap: 15px;
        margin-top: 5px;
    }

    .tamagotchi-buttons .button {
        width: 20px;
        height: 20px;
        background-color: #6dbbc9;
        border-radius: 50%;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        border: 2px solid #5aaab8;
        cursor: pointer;
    }

    .tamagotchi-buttons .button:hover {
        background-color: #5aaab8;
    }

    .tamagotchi-buttons .button:active {
        transform: scale(0.9);
        background-color: #4a99a7;
    }

    .btn-primary {
        padding: 0.75rem 1.5rem;
        background-color: #9db5fd;
        color: white;
        border-radius: 0.5rem;
        transition: all 0.2s;
        font-family: 'NeoDunggeunmo', sans-serif;
        clip-path: polygon(
            0% 10%, 4% 0%, 96% 0%, 100% 10%,
            100% 90%, 96% 100%, 4% 100%, 0% 90%
        );
    }

    .btn-primary:hover {
        background-color: #7b93fb;
        transform: translateY(-2px);
    }


    .point-icon {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA9ElEQVR4nGNgoBAwYsOMMIyiEF0xTA0TugJ0xTCa0c3NDWwATDFMM0wzEzZDkA1AtxhmCBNMA7oCbIphmJubG1MxDKArhmFkw5mwKUY2hBGbJqgBcAyzhAlZAS7F6JphmAnZZejqmdAV4FIMw0xQlzLhUgwDTLgUwzATLsUwzIRLMQwz4VIMw0y4FKMDSB5gxKUYhplwKYZhJlyKYZgJl2IYZsKlGIaZcCmGYSZcimGYCZdiGGbCpRiGmXAphkVMMB7F6IaA0wkwjqHpABg/0LQLVM+ETTEyZkI2CMkSRpAaXIqRvQI3gAkkiEsxsgVwl8AUwzAA2Ok+muhJZOAAAAAASUVORK5CYII=");
    }

    button {
        transition: all 0.2s ease-in-out;
        font-family: 'Noto Sans KR', sans-serif;
    }
    
    /* 복사 버튼을 제외한 버튼에만 호버 효과 적용 */
    button:not(.absolute) {
        transition: all 0.2s ease-in-out;
    }
    
    button:not(.absolute):hover {
        transform: translateY(-1px);
    }
    
    input:focus {
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }

    h1, h2 {
        font-family: 'Noto Sans KR', sans-serif;
        letter-spacing: -0.5px;
    }

    .page-layout {
        position: relative;
        max-width: 100%;
        margin: 0 auto;
        padding: 1rem;
    }

    .main-content {
        max-width: 1000px;
        margin: 0 auto;
    }

    .banner-sidebar {
        position: absolute;
        top: 1rem;
        right: -2rem;
        width: 250px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    /* 모바일에서 세로 레이아웃으로 변경 */
    @media (max-width: 768px) {
        .main-content {
            padding-right: 0;
        }

        .banner-sidebar {
            position: static;
            width: 100%;
            margin-bottom: 2rem;
        }
    }
</style>
