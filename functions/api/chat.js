/**
 * Cloudflare Pages Function (POST handler)
 * URL: /api/chat
 * * リクエストのJSON: { "text": "H3110 W0r1d" }
 * レスポンスのJSON: { "translation": "Hello World" }
 */
export async function onRequest(context) {
    // POSTリクエスト以外は拒否
    if (context.request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // 環境変数からAPIキーを取得 (Cloudflareのダッシュボードで設定する)
    const GEMINI_API_KEY = context.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not set' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // フロントエンドから送られてきたJSONを取得
        const requestData = await context.request.json();
        const leetText = requestData.text;

        if (!leetText) {
            return new Response(JSON.stringify({ error: 'No text provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // --- Gemini API へのリクエスト ---
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        // AIへの指示 (プロンプト)
        const prompt = `あなたはインターネットスラングの専門家です。以下の「Leet語（1337 speak）」を、文脈を推測して自然な英語に翻訳してください。翻訳結果だけを返してください。

Leet語: "${leetText}"
英語翻訳:`;

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
            throw new Error(`Gemini API error: ${apiResponse.status} ${apiResponse.statusText}`);
        }

        const responseData = await apiResponse.json();
        
        // Geminiからのレスポンスを取得
        // (注: レスポンスの構造はAPIバージョンによって変わる可能性あり)
        const translation = responseData.candidates[0]?.content?.parts[0]?.text || "Translation not found.";

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
