export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
  priority: 'low' | 'medium' | 'high';
  note?: string;
}

export type TodoFilter = 'all' | 'active' | 'completed';
