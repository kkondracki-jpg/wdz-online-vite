/* WDZ Admin – firebase-init.js
 * Re-exports Firebase instances from game's config for admin use.
 * Admin uses SESSION persistence (set here).
 */
import { db, auth, firebase } from "../firebase/config.js";

auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

export { db, auth, firebase };
