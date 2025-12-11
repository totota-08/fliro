import { onMounted, ref } from 'vue'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'

const user = ref<User | null>(null)
const loading = ref(true)
let initialized = false

export function useAuth() {
  if (!initialized) {
    initialized = true
    onMounted(() => {
      onAuthStateChanged(auth, (u) => {
        user.value = u
        loading.value = false
      })
    })
  }

  return {
    user,
    loading,
  }
}
