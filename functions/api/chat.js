/**
 * Cloudflare Pages Function (POST handler)
 * URL: /api/chat
 * リクエストのJSON: { "text": "H3110", "mode": "fromLeet" }
 * または { "text": "Hello", "mode": "toLeet" }
 * レスポンスのJSON: { "translation": "Hello" }
 */
export async function onRequest(context) {
    // POSTリクエスト以外は拒否
    if (context.request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // 環境変数からAPIキーを取得
    const GEMINI_API_KEY = context.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not set in Cloudflare' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // フロントエンドから送られてきたJSONを取得
        const requestData = await context.request.json();
        const inputText = requestData.text;
        const mode = requestData.mode; // 'toLeet' または 'fromLeet'

        if (!inputText || !mode) {
            return new Response(JSON.stringify({ error: 'No text or mode provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // --- Gemini API へのリクエスト ---
        // Naoが教えてくれた最新モデル (2.5-flash) を使う！
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        // AIへの指示 (プロンプト) を mode によって切り替える
        let prompt;
        if (mode === 'toLeet') {
            prompt = `あなたはインターネットスラングの専門家です。以下の「英語」を、文脈を読み取りつつ、可能な限り「Leet語（1337 speak）」に翻訳してください。単なる文字の置き換え（A=4など）だけでなく、スラング（you=j00など）も使ってください。翻訳結果のテキストだけを返してください。

英語: "${inputText}"
Leet語翻訳:`;
        } else { // mode === 'fromLeet'
            prompt = `あなたはインターネットスラングの専門家です。以下の「Leet語（1337 speak）」を、文脈を推測して自然な「英語」に翻訳してください。翻訳結果のテキストだけを返してください。

Leet語: "${inputText}"
英語翻訳:`;
        }

        const apiRequestBody = {
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ],
            // 安全設定 (任意)
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            ],
        };

        const apiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(apiRequestBody),
        });

        if (!apiResponse.ok) {
            // APIからのエラーレスポンスをそのまま返す
            const errorBody = await apiResponse.json();
            console.error('Gemini API error:', errorBody);
            throw new Error(errorBody.error?.message || `Gemini API error: ${apiResponse.status}`);
        }

        const responseData = await apiResponse.json();
        
        // レスポンスの構造を安全にチェック
        let translation = "Translation not found.";
        if (responseData.candidates && responseData.candidates[0] &&
            responseData.candidates[0].content && responseData.candidates[0].content.parts &&
            responseData.candidates[0].content.parts[0] && responseData.candidates[0].content.parts[0].text) {
            
            translation = responseData.candidates[0].content.parts[0].text;
        } else {
            console.warn("Unexpected Gemini response structure:", responseData);
        }

        // フロントエンドに翻訳結果を返す
        return new Response(JSON.stringify({ translation: translation.trim() }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in function:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
