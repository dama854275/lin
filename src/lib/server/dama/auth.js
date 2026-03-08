import { supabaseServer } from '$lib/supabase/server';
import crypto from 'crypto';

// 로그인키 생성 함수
export function generateLoginKey() {
    return crypto.randomBytes(32).toString('hex');
}

// 토큰 생성 함수
export function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// 인증만 수행하고 로그인키는 갱신하지 않는 함수
export async function authenticateOnly(email, password) {
    try {
        // 항상 새로운 인증 수행
        const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
            email,
            password
        });

        if (authError) throw authError;

        return {
            success: true,
            userId: authData.user.id,
            session_token: authData.session.access_token
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 사용자 인증 및 로그인키 갱신
export async function authenticateAndUpdateLoginKey(email, password) {
    try {
        // 1. auth.users 테이블에서 사용자 인증
        const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
            email,
            password
        });

        if (authError) throw authError;

        // 2. 새로운 로그인키 생성
        const loginKey = generateLoginKey();

        // 3. user_info 테이블의 login_key 업데이트
        const { error: updateError } = await supabaseServer
            .from('user_info')
            .update({ login_key: loginKey })
            .eq('user_id', authData.user.id);

        if (updateError) throw updateError;

        return {
            success: true,
            loginKey,
            userId: authData.user.id,
            session_token: authData.session.access_token
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 한국 시간으로 변환하고 초까지만 표시하는 함수
function formatToKST(date) {
    if (!date) return null;
    const kstDate = new Date(date);
    kstDate.setHours(kstDate.getHours() + 9); // UTC to KST
    return kstDate.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

// 날짜값을 1 또는 0으로 변환하는 함수
function convertDateToBinary(date) {
    return date ? 1 : 0;
}

// 사용자 정보 조회 (특정 컬럼)
export async function getUserInfo(email, password, column) {
    try {
        // 1. 사용자 인증
        const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
            email,
            password
        });

        if (authError) throw authError;

        // 2. user_info 테이블에서 특정 컬럼 조회
        const { data, error } = await supabaseServer
            .from('user_info')
            .select(column)
            .eq('user_id', authData.user.id)
            .single();

        if (error) throw error;

        // 날짜 형식의 컬럼인 경우 1 또는 0으로 변환
        const value = data[column];
        const formattedValue = value instanceof Date ? convertDateToBinary(value) : value;

        return {
            success: true,
            [column]: formattedValue
        };
    } catch (error) {
        console.error('Get user info error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 토큰 업데이트
export async function updateToken(email, password, tokenColumn) {
    try {
        // 1. 사용자 인증
        const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
            email,
            password
        });

        if (authError) throw authError;

        // 2. 새로운 토큰 생성
        const newToken = generateToken();

        // 3. 컬럼명에서 product 타입 추출 (예: token_Odin -> Odin)
        const productType = tokenColumn.replace('token_', '');
        const productColumn = `product_${productType}`;

        // 4. user_info 테이블의 토큰 컬럼 업데이트
        const { data, error } = await supabaseServer
            .from('user_info')
            .update({ [tokenColumn]: newToken })
            .eq('user_id', authData.user.id)
            .select(`${tokenColumn}, ${productColumn}`)
            .single();

        if (error) throw error;

        // product 컬럼값을 1 또는 0으로 변환
        const productValue = data[productColumn];
        const formattedProductValue = productValue ? 1 : 0;

        // 응답 키에서 접미사 제거
        const baseType = productType;
        return {
            success: true,
            token: data[tokenColumn],
            product: formattedProductValue
        };
    } catch (error) {
        console.error('Update token error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 토큰 값 조회
export async function checkToken(email, password, tokenColumn) {
    try {
        // 1. 사용자 인증
        const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
            email,
            password
        });

        if (authError) throw authError;

        // 2. 컬럼명에서 product 타입 추출 (예: token_Odin -> Odin)
        const productType = tokenColumn.replace('token_', '');
        const productColumn = `product_${productType}`;

        // 3. user_info 테이블에서 토큰 컬럼과 product 컬럼 조회
        const { data, error } = await supabaseServer
            .from('user_info')
            .select(`${tokenColumn}, ${productColumn}`)
            .eq('user_id', authData.user.id)
            .single();

        if (error) throw error;

        // product 컬럼값을 1 또는 0으로 변환
        const productValue = data[productColumn];
        const formattedProductValue = productValue ? 1 : 0;

        // 응답 키에서 접미사 제거
        return {
            success: true,
            token: data[tokenColumn],
            product: formattedProductValue
        };
    } catch (error) {
        console.error('Check token error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}