# Styles Implementation Update (Based on DESIGN.md)

本文件紀錄了基於 `DESIGN.md` 所進行的前端 CSS 樣式及 Tailwind Config 更新。依據規定，當有前端樣式／結構調整時，需記錄於 `docs/` 資料夾內。

## 修改核心
完全拋棄了舊有的設計 (Rock Gray / Fog Blue 系列)，並全新建構了以 Notion 為靈感的空白畫布（blank canvas）主題，擁有微暖色特徵以及輕透的無極限陰影邊界系統。

### 1. `tailwind.config.js` 
引入 `notion` 色票、圓角、文字和特殊設定：
- **顏色系統 (`colors.notion`)**：加上了 `black`, `blue`, `warmWhite`, `warmDark` 甚至 `gray`。
- **圓角系統 (`borderRadius`)**：引入 `micro` (4px)、`sm` (5px)、`md` (8px)、`lg` (12px)、`xl` (16px) 等級別以對應 `DESIGN.md` 的規畫。
- **陰影系統 (`boxShadow`)**：寫入了 Notion 多層次的 `soft-card` 陰影與 `deep` 深層卡片陰影，營造自然真實的光線效果。

### 2. `src/index.css`
重新結構化了全域 CSS，加入下列元件化及排版階層 Utilities：
- **Utilities (`@layer utilities`)**：包含 `.notion-whisper-border` 極細邊框、多種標題階層 (`.notion-text-hero`, `.notion-text-h1`...等) 及字距高度校正設定（例如 tracking-[-2.125px] 壓縮巨型標題）。
- **Components (`@layer components`)**：
  - `.notion-btn-primary`, `.notion-btn-secondary`, `.notion-btn-ghost` : 按鈕系統。
  - `.notion-badge` : Pill badge 藥丸標籤，具有指定的字距與色彩。
  - `.notion-card` : `12px` 微圓角、配上 `soft-card` 專屬陰影。
  - `.notion-input` : 輸入框統一處理焦點 Focus ring，顏色採用 Notion Focus blue (`#097fe8`)。

## 未來指南
接下來若要調整各頁面（如 `ViewAllPage.jsx`），請直接使用上列建構好的 Utility Classes (例如 `.notion-card` 或 `.notion-text-hero`) 加速開發並保持嚴格一致性。
