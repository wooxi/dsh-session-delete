/**
 * Client dictionaries for this plugin's UI copy.
 *
 * Registered under the `sessionDelete` namespace through the DSH Client locale
 * service, so the copy follows the language picked in Settings → General and
 * switches without a reload. `zh` is the key-set source of truth; every other
 * dictionary is written against the same keys.
 */

/** Dictionary namespace owned by this plugin. */
export const NS = 'sessionDelete'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'session.menu': '删除会话',
  'session.title': '删除会话',
  'session.kicker': '此操作不可撤销',
  'session.question': '确定要永久删除这个会话吗？',
  'session.note': '会话记录和消息会从本机移除，删除后无法恢复。附件文件按内容去重保留。',
  'session.confirm': '删除会话',
  'workspace.title': '删除工作区',
  'workspace.kicker': '会同时删除其中的所有会话',
  'workspace.question': '确定要删除“{title}”及其中的 {count} 个会话吗？',
  'workspace.note':
    '工作区会从列表中移除，文件夹本身保留；其中的会话记录和消息都会永久删除，无法恢复。附件文件按内容去重保留。',
  'workspace.confirm': '删除工作区',
  'workspace.confirmWithCount': '删除工作区及 {count} 个会话',
  'workspace.cancelled': '已取消删除工作区',
  'progress.remaining': '正在删除会话…（剩余 {remaining} 个）',
  'busy': '正在删除…',
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'session.menu': 'Delete session',
  'session.title': 'Delete session',
  'session.kicker': 'This cannot be undone',
  'session.question': 'Permanently delete this session?',
  'session.note':
    'The session record and its messages are removed from this machine; they cannot be recovered. Attachment files are kept, deduplicated by content.',
  'session.confirm': 'Delete session',
  'workspace.title': 'Delete workspace',
  'workspace.kicker': 'Also deletes every session in it',
  'workspace.question': 'Delete “{title}” and its {count} sessions?',
  'workspace.note':
    'The workspace is removed from the list and the folder itself is kept. The session records and messages in it are permanently deleted and cannot be recovered. Attachment files are kept, deduplicated by content.',
  'workspace.confirm': 'Delete workspace',
  'workspace.confirmWithCount': 'Delete workspace and {count} sessions',
  'workspace.cancelled': 'Workspace deletion cancelled',
  'progress.remaining': 'Deleting sessions… ({remaining} left)',
  'busy': 'Deleting…',
}

/** French dictionary, checked against the English keys. */
export const fr = {
  'session.menu': 'Supprimer la session',
  'session.title': 'Supprimer la session',
  'session.kicker': 'Cette action est irréversible',
  'session.question': 'Supprimer définitivement cette session ?',
  'session.note':
    'L’enregistrement de la session et ses messages sont effacés de cette machine ; ils ne pourront pas être restaurés. Les fichiers joints sont conservés, dédupliqués par contenu.',
  'session.confirm': 'Supprimer la session',
  'workspace.title': 'Supprimer l’espace de travail',
  'workspace.kicker': 'Supprime aussi toutes ses sessions',
  'workspace.question': 'Supprimer « {title} » et ses {count} sessions ?',
  'workspace.note':
    'L’espace de travail est retiré de la liste et le dossier lui-même est conservé. Les enregistrements de sessions et leurs messages sont définitivement supprimés et ne pourront pas être restaurés. Les fichiers joints sont conservés, dédupliqués par contenu.',
  'workspace.confirm': 'Supprimer l’espace de travail',
  'workspace.confirmWithCount': 'Supprimer l’espace de travail et ses {count} sessions',
  'workspace.cancelled': 'Suppression de l’espace de travail annulée',
  'progress.remaining': 'Suppression des sessions… ({remaining} restantes)',
  'busy': 'Suppression…',
}
