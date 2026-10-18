import { connect } from "./connect.mts"

const { migrate, close } = await connect()
await migrate()
await close()
console.log("Migrations applied.")
