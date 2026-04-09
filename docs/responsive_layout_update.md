# Responsive Layout Implementation Update

本文件紀錄了系統響應式介面（Responsive UI）的實作細節。根據要求，當螢幕尺寸縮小時，側邊欄（Sidebar）將轉化為置頂導覽列（Sticky Header），並提供下拉式選單。

## 修改核心

### 1. `src/components/Layout.jsx`
- **結構切換**：根容器由 `flex` 改為 `flex-col md:flex-row`，以支持手機端的垂直佈局。
- **手機版 Header**：新增 `header.md:hidden` 區塊，置頂於螢幕上方。
- **下拉式選單**：
  - 實作 `isMobileMenuOpen` 狀態與 `AnimatePresence` 動畫。
  - 當選單開啟時，顯示主要導覽選項與收藏夾清單。
  - 整合 `SidebarSearch` 至手機版選單中。
- **Aside 退避**：原本的側邊欄改為 `hidden md:flex`，僅在平板或電腦端顯示。
- **內容間距調整**：將 `main` 的 Padding 從 `p-4 md:p-8` 優化為 `p-4 sm:p-6 md:p-8`，提供更好的小螢幕閱讀體驗。

### 2. `src/pages/HomePage.jsx`
- **移動端簡化**：在手機版隱藏「最近儲存」與 `CollectionBoard` 區塊，讓首頁聚焦於 URL 輸入。
- **間距優化**：調整頂部內距 (`pt`) 與標題邊距 (`mb`)。

### 3. `src/components/UrlInput.jsx`
- **組件收納**：在手機版隱藏左側 Link 圖示，縮小輸入框文字與按鈕內距，並隱藏按鈕內的箭頭圖示，防止在 narrow 螢幕下發生組件外溢。
- **輔助文字**：將平台的提示文字改為 `flex-wrap` 並縮小字級與間距。

### 4. `src/components/SidebarSearch.jsx`
- **面板定位**：修正搜尋結果面板在手機版選單中因 `right-[-240px]` 導致的嚴重偏移與外溢問題，現在會正確限制在容器寬度內。

### 5. `src/pages/InsightPage.jsx`
- **標題響應式**：Header 部分改為 `flex-col sm:flex-row`，在窄螢幕下按鈕會自動換行並保持間距。
- **字型調整**：主頁面標題在手機端由 `text-3xl` 微調為 `text-2xl` 以防溢出。
- **表格滾動**：分類策略表格容器加入了 `overflow-x-auto`，確保資料過多時可水平滑動而非撐破版面。

### 6. `src/components/StatCard.jsx`
- **數值適配**：統計數值的字型大小改為 `text-2xl sm:text-3xl`，避免 4 位數以上的數值在某些手機寬度下導致排版偏移。

### 7. `src/components/PostCard.jsx`
- **字體放大**：針對手機版大幅提升閱讀性，將原本極小的 `11px` 內容文字提升至 `14px (text-sm)`，作者名提升至 `16px (text-base)`。
- **空間極大化**：減少卡片在手機端的內距 (`px-3`)，結合外層容器內距的縮減，讓卡片內容能盡可能撐滿螢幕寬度，減少視覺壓迫感。

## 視覺規範 (Responsive Breakpoints)
- **Mobile**: `< 640px` (主要調整對象，包含堆疊式輸入框、放大字體與全寬卡片)。
- **Tablet**: `640px ~ 768px` (過渡期，保留部分桌面端樣式)。
- **Desktop**: `>= 768px` (完整的選單與功能顯示)。

## 視覺規範 (Responsive Breakpoints)
- **Mobile (< 768px)**: 置頂 Header + 下拉選單。
- **Tablet/Desktop (>= 768px)**: 左側固定側邊欄 (可縮合)。
