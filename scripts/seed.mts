import bcrypt from "bcryptjs"
import { addStaff, createClinic, findLogin } from "../src/server/accounts"
import { connect } from "./connect.mts"

const DEMO_PASSWORD = "sehat-demo"

const { db, migrate, close } = await connect()
await migrate()

if (await findLogin(db, "demo.admin")) {
  console.log("Demo clinic already exists.")
} else {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const { clinic } = await createClinic(db, { clinicName: "Demo Clinic", name: "Demo Admin", username: "demo.admin", passwordHash })
  await addStaff(db, clinic.id, { name: "Dr. Demo", username: "demo.doctor", role: "doctor", passwordHash })
  await addStaff(db, clinic.id, { name: "Front Desk", username: "demo.reception", role: "reception", passwordHash })
  console.log(`Demo clinic created. Users: demo.admin, demo.doctor, demo.reception — password "${DEMO_PASSWORD}"`)
}

await close()
