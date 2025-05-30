// サンプルTypeScriptファイル
interface User {
  id: number
  name: string
  email: string
  isActive: boolean
}

export class UserService {
  private users: User[] = []

  constructor() {
    console.log('UserService initialized')
  }

  addUser(user: User): void {
    this.users.push(user)
    console.log(`User added: ${user.name}`)
  }

  getUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id)
  }

  getAllUsers(): User[] {
    return [...this.users]
  }
}

// サービスの初期化
const userService = new UserService()

// ユーザーの追加
userService.addUser({
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  isActive: true,
})

console.log('All users:', userService.getAllUsers())
