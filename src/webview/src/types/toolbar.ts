// Todo
export interface Todo {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
 activeForm: string
}

export interface DiffEdit {
  oldString: string
  newString: string
  replaceAll?: boolean
}

export interface FileEdit {
  name: string
  filePath: string
  additions?: number
  deletions?: number
  /** All accumulated edits for this file (Edit/MultiEdit tool calls) */
  diffEdits?: DiffEdit[]
  /** True when the file was created via Write (no prior version exists) */
  isNewFile?: boolean
}