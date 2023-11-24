require('dotenv').config()
const express = require("express")
const port = process.env.PORT || 5000
const app = express()
const cors = require("cors")
const cookieParser = require('cookie-parser')
const jwt = require("jsonwebtoken")

// middlewere
app.use(express.json())
app.use(cors({
    origin: ["http://localhost:5173"],
    credentials: true
}))
app.use(cookieParser())


// token varify
const varifyToekn = (req, res, next) => {
    const token = req.query.token
    if (!token) {
        res.status(401).send({ messege: "unAuthorized Access" })
        return
    }

    jwt.verify(token, process.env.SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ messege: "Access Forbidden" })
        }
        req.user = decoded

        next()
    })

}





const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.xbiw867.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });

        const apartmentCollection = client.db("centerPoint").collection("apartments")
        const usersCollection = client.db("centerPoint").collection("users")
        const announcementsCollection = client.db("centerPoint").collection("announcements")
        const agreementsCollection = client.db("centerPoint").collection("agreements")

        // all apartment data
        app.get("/api/apartments", async (req, res) => {
            const limit = parseInt(req.query.limit) || 6
            const page = parseInt(req.query.page) || 0

            const skip = (limit * page)

            const result = await apartmentCollection.find().skip(skip).limit(limit).toArray()
            const totalData = await apartmentCollection.estimatedDocumentCount()
            res.send([result, totalData])

        })


        // user token api
        app.post("/api/user/token", async (req, res) => {
            const email = req.body
            const token = jwt.sign(email, process.env.SECRET, { expiresIn: "365d" })
            res.send(token)
        })

        app.put("/api/add/user/:email", async (req, res) => {
            const email = req.params.email

            const body = req.body
            const timestamp = { timestamp: Date.now() }
            const accountCreatedDate = Date.now()
            const updateUser = {
                $set: {
                    ...body, ...timestamp
                }
            }

            const isExist = await usersCollection.find({ email: email }).toArray()

            if (isExist.length !== 0) {
                const update = await usersCollection.updateOne({ email: email }, updateUser)
                return res.send({ isExist: true })
            }




            const result = await usersCollection.insertOne({ ...body, create: accountCreatedDate, ...timestamp })
            res.send(result)

        })

        // single user data
        app.get("/api/user", varifyToekn, async (req, res) => {
            const email = req.query.email
            const result = await usersCollection.findOne({ email: email })
            res.send(result)
        })


        // all members data
        app.get("/api/all/members", async (req, res) => {
            const role = req.query.role
            if (role !== "admin" || !role) {
                return res.status(401).send({ messege: "unAurhorized" })
            }
            const result = await usersCollection.find({ role: "member" }).toArray()
            res.send(result)

        })


        // Announcements
        app.get("/api/announcements", varifyToekn, async (req, res) => {
            const result = await announcementsCollection.find().toArray()

            res.send(result)
        })

        //agreement data post
        app.post("/api/agreement", varifyToekn, async (req, res) => {

            const data = req.body
            const result = await agreementsCollection.insertOne(data)
            res.send(result)
        })

        // all agreement data 

        app.get("/api/agreementReq", varifyToekn, async (req, res) => {
            const role = req.query.role
            if (role !== "admin" || !role) {
                return res.status(401).send({ messege: "unAurhorized" })
            }

            const result = await agreementsCollection.find({ status: "pending" }).toArray()
            res.send(result)
        })


        // get user role

        app.get("/api/user/role", varifyToekn, async (req, res) => {
            const email = req.query.email
            const result = await usersCollection.findOne({ email: email }, { projection: { _id: 0, role: 1 } })

            res.send(result)
        })



        // agreement req status changed
        app.put("/api/agreement/status", varifyToekn, async (req, res) => {

            const role = req.query.role
            const id = req.query.id
            if (role !== "admin" || !role) {
                return res.status(401).send({ messege: "unAurhorized" })
            }

            const update = {
                $set: {
                    status: "checked"
                }
            }

            const find = { _id: new ObjectId(id) }

            const result = await agreementsCollection.updateOne(find, update)
            res.send(result)

        })


        // user to member
        app.put("/api/user/role/update", varifyToekn, async (req, res) => {
            const role = req.query.role
            const email = req.query.email
            if (role !== "admin" || !role) {
                return res.status(401).send({ messege: "unAurhorized" })
            }

            const find = { email: email }

            const update = {
                $set: {
                    role: "member"
                }
            }

            const result = await usersCollection.updateOne(find, update)
            res.send(result)


        })




        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.listen(port, () => {
    console.log("server is running");
})