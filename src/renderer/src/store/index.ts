// Export all stores
export {
  useAuthStore,
  hasPermission,
  isVipOrAbove,
  isAdmin,
} from "./authStore";
export type { User } from "./authStore";

export { useResumeStore } from "./resumeStore";
