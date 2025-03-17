import { WebSocketServer } from "ws";
import { prisma } from "@repo/db/prisma"
const server = new WebSocketServer({ port: 3002 }); 

server.on('connection', async (socket) => {
    await prisma.user.create({
        data:{
            username: Math.random().toString(36).substring(7),  
            password: Math.random().toString(36).substring(7),  
            email: Math.random().toString(36).substring(7) + '@gmail.com'   
        }
    })
    socket.send('Connected to the server')
})