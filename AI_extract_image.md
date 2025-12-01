第一步：拆解與提取（給 Gemini 或 ChatGPT）
目的： 讓 AI 當你的眼睛，把原圖的「教學邏輯」單獨抓出來，不要受原圖畫風干擾。 操作： 上傳原圖，並輸入以下指令。

Prompt 1 (Copy & Paste):

"Act as an expert instructional designer. Analyze the attached image.

Ignore the artistic style. (Do not describe colors, fonts, or art style).

Extract the core teaching logic. What is being taught? What are the key steps, hierarchy, or relationships shown?

Output the pure content as a structured list or bullet points in English. This will be the base for a new creation."

第二步：改寫與視覺轉譯（給 Gemini 或 ChatGPT）
目的： 將第一步得到的「純文字邏輯」改寫（如你所說的優化內容），並轉化為 Nano Banana 看得懂的「畫面描述」。 操作： 延續上一個對話（或貼上第一步的結果），輸入以下指令。

Prompt 2 (Copy & Paste):

"Now, take the extracted content and strictly follow these two tasks:

Task A: Content Rewrite Rewrite the educational content to be [Insert your preference: e.g., simpler, more professional, funny, summarized].

Task B: Visual Translation for AI Image Generator Create a 'Subject-Only' description for an AI image generator based on the rewritten content.

Describe the visual subject (e.g., 'a diagram showing...', 'a character doing...', 'an exploded view of...').

DO NOT include style words (e.g., do not say 'cartoon', 'realistic', 'watercolor'). Keep it neutral.

Focus on composition and objects.

Output format: Just give me the Subject Description paragraph in English."

第三步：組合與生成（給 Nano Banana）
目的： 這是最後一步。將你的「風格」與第二步產生的「內容」結合。 操作： 在 Nano Banana 的 Prompt 輸入框中，使用這個公式。

Prompt 3 (Nano Banana Formula):

[你的風格關鍵字] + [第二步產出的 Subject Description] + [品質與排版修飾詞]

💡 實際填空範例（您可以直接參考這個結構）：
[你的風格關鍵字] (這部分由您定義):

例如：Flat vector art style, minimalism, pastel color palette (扁平向量、極簡、粉嫩色)

或是：Cyberpunk style, neon lights, high contrast, futuristic (賽博龐克、霓虹、高對比)

[第二步產出的 Subject Description]:

(貼上剛剛 AI 幫你寫好的那段關於教學內容的畫面描述)

[品質與排版修飾詞] (Nano Banana 最佳實踐):

white background, clean layout, knolling, 8k resolution, high quality, textless --ar 2:3