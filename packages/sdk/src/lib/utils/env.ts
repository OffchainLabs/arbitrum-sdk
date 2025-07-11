import * as dotenv from 'dotenv'
import * as path from 'path'

export const loadEnv = () => {
  dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') })
}
