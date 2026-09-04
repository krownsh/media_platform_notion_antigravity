# 前端資料載入

## 貼文與擷取狀態

- `App.jsx` 是首次載入 `posts` 與擷取歷史的唯一入口；首頁、所有貼文與貼文詳情只讀取 Redux store，不可自行重複請求。
- 同一時間只允許一個 `/api/posts` 請求。重複 dispatch 在 Saga 層會被忽略，避免 React 開發模式或元件掛載造成重複網路請求。
- 首次載入使用 `loading` 顯示 skeleton；已經有內容後的更新使用 `refreshing`，不可清空現有列表或顯示整頁 skeleton。
- Hermes 為外部 Cron Pull 工作流，前端不再以固定 15 秒輪詢 `/api/posts`。擷取完成時，capture monitor 會主動更新貼文資料。

## 分類與媒體呈現

- 所有貼文頁的分類篩選必須包含：`ai`、`tool`、`market`、`security`、`opinion`、`research`、`launch`、`productivity`、`design`、`crypto`、`other`。
- 卡片只有在取得可用圖片 URL 時才渲染媒體區塊；沒有圖片的來源直接從文章內容開始呈現。
