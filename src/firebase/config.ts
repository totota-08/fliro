/**
 * 互換用の再エクスポート（実体は @/lib/firebase）
 *
 * Database / Storage / Functions は初期表示のバンドルに載せないため、
 * それぞれ @/lib/firebaseDatabase, @/lib/firebaseStorage,
 * @/lib/firebaseFunctions から直接 import すること。
 */
export { app, auth, db, githubProvider, googleProvider } from "@/lib/firebase";
