export default {
	// 指令
	"cmd.syncAll": "同步所有雙向關聯",

	// 通知
	"notice.syncComplete": "同步完成：已更新 {0} 個檔案",
	"notice.pairCreated": "✅ 配對：{0} ↔ {1}",
	"notice.fileNotFound": "⚠️ 找不到檔案：{0}.md",
	"notice.backlinkAdded": "✅ {0} → {1}：{2}",
	"notice.backlinksCreated": "✅ {0}：已從 {1} 個檔案建立反向連結",
	"notice.pairRemoved": "已解除 {0} 的配對",
	"notice.fieldUpdate": "YBR：{0} → 正在建立/更新「{1}」欄位：{2}",

	// 設定
	"settings.fullSync": "全量同步",
	"settings.fullSync.desc": "⚠️ 執行全量同步會一口氣偵測所有沒配對的欄位一次性同步，可能會改變已有內容的 YAML frontmatter，使用前請務必確認。",
	"settings.fullSync.button": "執行全量同步",
	"settings.autoSync": "自動同步",
	"settings.autoSync.desc": "檔案修改時自動同步雙向關聯",
	"settings.useDisplayName": "使用 title 作為顯示名稱",
	"settings.useDisplayName.desc": "反向連結使用 title 欄位作為顯示文字（例如 [[檔名|title]]）。關閉時只顯示檔名。變更後請執行全量同步。",
	"settings.debug": "除錯模式",
	"settings.debug.desc": "在開發者主控台輸出詳細日誌",
	"settings.relationPairs": "欄位配對",
	"settings.fieldA": "欄位 A",
	"settings.fieldB": "欄位 B",
	"settings.deletePair": "刪除配對",
	"settings.addPair": "+ 新增配對",

	// 彈窗
	"modal.title": "偵測到新的關聯欄位",
	"modal.hasField": "「{0}」有一個包含 wikilink 的「{1}」欄位。",
	"modal.question": "當「{0}」連結到另一個檔案時，目標檔案的哪個欄位應該接收反向連結？",
	"modal.currentPairs": "目前的配對（{0}）",
	"modal.backlinkField": "反向連結欄位",
	"modal.backlinkField.desc": "目標頁面中要反向連結的欄位",
	"modal.sameField": "{0}（同名欄位）",
	"modal.newFieldName": "或輸入新的欄位名稱",
	"modal.newFieldPlaceholder": "留空則使用上方選擇的欄位",
	"modal.save": "儲存",
	"modal.ignore": "忽略",
	"modal.editTitle": "雙向連結設定",
	"modal.currentlyPaired": "「{0}」目前與「{1}」配對中。",
	"modal.removePair": "解除配對",
	"modal.close": "關閉",
	"modal.addAnother": "為此欄位新增配對：",
	"modal.pairTag": "來源 Tag 為「{0}」時",
	"modal.pairTagAny": "任何 Tag（備選）",
	"modal.active": "適用中",
	"modal.context": "Tag：{0} → 欄位：{1}",
	"modal.noPairForTag": "⚠️ Tag「{0}」沒有對應的配對，此頁面的這個欄位不會同步。請在下方新增配對。",

	// 設定：標籤欄位
	"settings.tagA": "Tag A",
	"settings.tagB": "Tag B",

	// 彈窗：標籤相關
	"modal.counterpartTag": "目標 Tag",
	"modal.counterpartTag.desc": "用來識別此配對目標頁面的 Tag",
	"modal.counterpartTag.field": "目標欄位",
	"modal.counterpartTag.placeholder": "輸入 Tag",
	"modal.sourceTag": "此頁面的 Tag",
	"modal.sourceTag.required": "此頁面沒有 Tag，需要設定 Tag 才能建立配對。",
	"modal.existingPairs": "已設定的配對",

	// 屬性按鈕
	"property.paired": "已配對：{0} ↔ {1}",
	"property.clickToSetup": "設定雙向連結",

	// 右鍵選單
	"menu.configurePair": "設定雙向連結",
	"menu.editPair": "編輯雙向連結",
} as Record<string, string>;
