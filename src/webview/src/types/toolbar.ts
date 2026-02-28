// Todo
export interface Todo {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
 activeForm: string
}

export interface FileEdit {
  name: string
  filePath: string
  additions?: number
  deletions?: number
}