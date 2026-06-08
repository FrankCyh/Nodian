export default {
	// Command
	"cmd.syncAll": "Sync all bidirectional relations",

	// Notices
	"notice.syncComplete": "Sync complete: updated {0} files",
	"notice.pairCreated": "✅ Pair: {0} ↔ {1}",
	"notice.fileNotFound": "⚠️ File not found: {0}.md",
	"notice.backlinkAdded": "✅ {0} → {1}: {2}",
	"notice.backlinksCreated": "✅ {0}: backlinks created from {1} file(s)",
	"notice.pairRemoved": "Pair removed for {0}",
	"notice.fieldUpdate": "YBR: {0} → creating/updating \"{1}\" field with {2}",

	// Settings
	"settings.fullSync": "Full sync",
	"settings.fullSync.desc": "⚠️ Full sync detects all unpaired fields and syncs them at once. This may modify existing YAML frontmatter — please review before running.",
	"settings.fullSync.button": "Run Full Sync",
	"settings.autoSync": "Auto sync",
	"settings.autoSync.desc": "Automatically sync bidirectional relations on file modify",
	"settings.useDisplayName": "Use title as display name",
	"settings.useDisplayName.desc": "Use the title field as display text in backlinks (e.g. [[filename|title]]). When off, backlinks use filename only. Run Full Sync after changing.",
	"settings.debug": "Debug mode",
	"settings.debug.desc": "Output detailed logs to the developer console",
	"settings.relationPairs": "Relation Pairs",
	"settings.fieldA": "Field A",
	"settings.fieldB": "Field B",
	"settings.deletePair": "Delete pair",
	"settings.addPair": "+ Add Pair",

	// Modal
	"modal.title": "New relation field detected",
	"modal.hasField": "\"{0}\" has a \"{1}\" field with wikilinks.",
	"modal.question": "When \"{0}\" links to another file, what field in THAT file should get the backlink?",
	"modal.currentPairs": "Current pairs ({0})",
	"modal.backlinkField": "Backlink field",
	"modal.backlinkField.desc": "The field in the TARGET file that will receive the backlink",
	"modal.sameField": "{0} (same field)",
	"modal.newFieldName": "Or type a new field name",
	"modal.newFieldPlaceholder": "leave empty to use selection above",
	"modal.save": "Save",
	"modal.ignore": "Ignore",
	"modal.editTitle": "Bidirectional Relation",
	"modal.currentlyPaired": "\"{0}\" is currently paired with \"{1}\".",
	"modal.removePair": "Remove Pair",
	"modal.close": "Close",
	"modal.addAnother": "Add another pair for this field:",
	"modal.active": "Active",
	"modal.noPairForPattern": "⚠️ No pair pattern matches \"{0}\". Sync is inactive for this field on this page. Add a pair below.",

	// Settings: path pattern fields
	"settings.patternA": "Pattern A",
	"settings.patternB": "Pattern B",

	// Modal: path pattern-related
	"modal.counterpartPattern": "Target path regex",
	"modal.counterpartPattern.desc": "Regex that identifies target files for this pair",
	"modal.counterpartPattern.field": "Target field",
	"modal.counterpartPattern.placeholder": "Enter path regex",
	"modal.sourcePattern": "Path regex for this page",
	"modal.sourcePattern.desc": "Regex for the current side of the relation. The default matches this file's directory.",
	"modal.existingPairs": "Existing pairs",

	// Property buttons
	"property.paired": "Paired: {0} ↔ {1}",
	"property.clickToSetup": "Set up bidirectional relation",

	// Context menu
	"menu.configurePair": "Configure bidirectional relation",
	"menu.editPair": "Edit bidirectional relation",
} as Record<string, string>;
