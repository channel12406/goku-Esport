/**
 * Script d'initialisation du profil robot
 *
 * Usage: node scripts/init-robot.js
 *
 * Ce script:
 * 1. Connecte le robot à Firebase Auth
 * 2. Appelle la fonction serveur initRobotProfile
 * 3. Crée le profil avec 1M de PXP
 */

const admin = require("firebase-admin");
const serviceAccount = require("../firebase-service-account.json");

// Initialisation Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mon-shop-70e50-default-rtdb.firebaseio.com",
});

const auth = admin.auth();
const db = admin.firestore();

async function initRobotProfile() {
  try {
    console.log("🤖 Initialisation du profil robot...");

    // Configuration depuis .env
    const ROBOT_EMAIL = process.env.FIREBASE_ROBOT_EMAIL || "robotfirearena@gmail.com";
    const ROBOT_PASSWORD = process.env.FIREBASE_ROBOT_PASSWORD;

    if (!ROBOT_PASSWORD) {
      throw new Error("FIREBASE_ROBOT_PASSWORD non défini dans .env");
    }

    console.log(`📧 Email robot: ${ROBOT_EMAIL}`);

    // Vérifie si le profil existe déjà
    const users = await auth.getUsersByEmail([ROBOT_EMAIL]);
    const robotUser = users.users[0];

    if (!robotUser) {
      throw new Error(
        `Compte robot ${ROBOT_EMAIL} non trouvé dans Firebase Auth. Créez-le d'abord.`,
      );
    }

    console.log(`✅ Compte robot trouvé: ${robotUser.uid}`);

    // Vérifie si le profil Firestore existe
    const profileRef = db.collection("profiles").doc(robotUser.uid);
    const profileSnap = await profileRef.get();

    if (profileSnap.exists) {
      const pxp = profileSnap.data().pxp || 0;
      console.log(`ℹ️  Profil robot existe déjà avec ${pxp} PXP`);
      console.log("✅ Initialisation terminée (profil existant)");
      return;
    }

    // Crée le profil
    const counterRef = db.collection("counters").doc("fire_arena_id");
    const counterSnap = await counterRef.get();
    const next = (counterSnap.exists() ? counterSnap.data().value || 0 : 0) + 1;
    const fireArenaId = `FA-${String(next).padStart(5, "0")}`;

    const ROBOT_INITIAL_PXP = 1000000;

    await db.runTransaction(async (transaction) => {
      transaction.set(counterRef, { value: next });

      transaction.set(profileRef, {
        username: "FireArena Robot",
        display_name: "FireArena Robot",
        email: ROBOT_EMAIL,
        avatar_url: null,
        fire_arena_id: fireArenaId,
        pxp: ROBOT_INITIAL_PXP,
        level: 99,
        reputation: 1000,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        language: "fr",
        can_create_tournaments: true,
        is_banned: false,
        profile_update_count: 0,
        is_robot: true,
      });

      const txRef = db.collection("pxp_transactions").doc();
      transaction.set(txRef, {
        user_id: robotUser.uid,
        amount: ROBOT_INITIAL_PXP,
        reason: "Initialisation robot de service",
        created_by: robotUser.uid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        type: "robot_init",
      });
    });

    console.log(`✅ Profil robot créé avec succès:`);
    console.log(`   - FireArena ID: ${fireArenaId}`);
    console.log(`   - PXP initial: ${ROBOT_INITIAL_PXP.toLocaleString()}`);
    console.log(`   - UID: ${robotUser.uid}`);
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation:", error.message);
    process.exit(1);
  }
}

// Charge les variables d'environnement
require("dotenv").config();

initRobotProfile()
  .then(() => {
    console.log("✅ Initialisation terminée avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  });
