import express, { Request, Response } from 'express';  
import { prisma } from "@repo/db/prisma"
const port = 3001
const app = express()
app.use(express.json())
app.get('/', (req: Request, res: Response) => {
    res.send('Hello from http server!!!')
})
app.post('/signup', async (req: Request, res: Response) => {
    const { username, email, password } = req.body
    const user = await prisma.user.create({
        data:{
            username,
            email,
            password
        }
    })

    res.json({
        message: 'Signup successful' ,
        user   
    })
})
app.listen(port, () => {
    console.log('Listening on port: ', port)
})