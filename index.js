require('dotenv').config()
const express = require("express")
const port = process.env.PORT || 5000
const app = express()
const cors = require("cors")
const cookieParser = require('cookie-parser')
const jwt = require("jsonwebtoken")
const stripe = require("stripe")(process.env.STRIPE)

// middlewere
app.use(express.json())
app.use(cors({
    origin: ["http://localhost:5173", "https://assignment-12-65a07.web.app"],
    credentials: true
}))
app.use(cookieParser())


// token varify
const varifyToken = (req, res, next) => {
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
const { default: Stripe } = require('stripe')
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
        const couponsCollection = client.db("centerPoint").collection("coupons")
        const paymentHistoryCollection = client.db("centerPoint").collection("paymentHistory")


        const varifyAdmin = async (req, res, next) => {
            const email = req?.user?.email


            const result = await usersCollection.findOne({ email: email })

            if (!result || result?.role !== "admin") {
                return res.status(401).send({ messege: "unauthorized access" })
            }

            next()

        }
        const varifyMember = async (req, res, next) => {
            const email = req?.user?.email


            const result = await usersCollection.findOne({ email: email })

            if (!result || result?.role !== "member") {
                return res.status(401).send({ messege: "unauthorized access" })
            }

            next()

        }


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
            const existUpdate = {
                $set: {
                    timestamp: Date.now()
                }
            }
            if (isExist.length !== 0) {
                const update = await usersCollection.updateOne({ email: email }, existUpdate)
                return res.send({ isExist: true })
            }




            const result = await usersCollection.insertOne({ ...body, create: accountCreatedDate, ...timestamp })
            res.send(result)

        })

        // single user data
        app.get("/api/user", varifyToken, async (req, res) => {
            const email = req.query.email
            const result = await usersCollection.findOne({ email: email })
            res.send(result)
        })


        // all members data
        app.get("/api/all/members", varifyToken, async (req, res) => {
            const role = req.query.role
            if (role !== "admin" || !role) {
                return res.status(401).send({ messege: "unAurhorized" })
            }
            const result = await usersCollection.find({ role: "member" }).toArray()
            res.send(result)

        })


        // Announcements
        app.get("/api/announcements", varifyToken, async (req, res) => {
            const result = await announcementsCollection.find().toArray()

            res.send(result)
        })

        //agreement data post
        app.post("/api/agreement", varifyToken, async (req, res) => {

            const data = req.body
            const result = await agreementsCollection.insertOne(data)
            res.send(result)
        })

        // all agreement data 

        app.get("/api/agreementReq", varifyToken, async (req, res) => {
            const role = req.query.role
            if (role !== "admin" || !role) {
                return res.status(401).send({ messege: "unAurhorized" })
            }

            const result = await agreementsCollection.find().toArray()
            res.send(result)
        })


        // -------------member apartment ----------------
        app.get("/api/member/apartment", varifyToken, async (req, res) => {
            const email = req.query.email
            const role = req.query.role

            if (!role || role !== "member") {
                return res.status(401).send({ messege: "unAurhorized" })
            }



            const find = {
                $and: [
                    { status: "checked" },
                    { userEmail: email }
                ]
            }
            const result = await agreementsCollection.findOne(find)
            res.send(result)
        })


        // ---------member to user--------------
        // * member will become user
        // * member booked room will be available
        // * remove apartement from user 

        app.put("/api/member/delete", varifyToken, varifyAdmin, async (req, res) => {
            const email = req.query.email
            const apartmentId = req.query.aptId

            //---------point 1_--------
            const roleUpdate = {
                $set: {
                    role: "user"
                }
            }


            const becomeUser = await usersCollection.updateOne({ email: email }, roleUpdate)

            // -------part 2---------
            const apartmentUpdate = {
                $set: {
                    booked: "false"
                }
            }

            const apartmentFind = { _id: new ObjectId(apartmentId) }

            const updateApt = await apartmentCollection.updateOne(apartmentFind, apartmentUpdate)


            //---------part 3 -----------
            const aptUpdate = {
                $set: {
                    apartment: ""
                }
            }
            const removeApartmentFromUser = await usersCollection.updateOne({ email: email }, aptUpdate)

            res.send(removeApartmentFromUser)


        })



        app.post("/api/makeAnnouncement", varifyToken, varifyAdmin, async (req, res) => {
            const body = req.body
            const result = await announcementsCollection.insertOne(body)
            res.send(result)

        })


        //  memberProfile data

        app.get("/api/member/data", varifyToken, varifyMember, async (req, res) => {
            const email = req.query.email
            if (!email) {
                return
            }

            if (req?.user?.email !== email) {
                return res.status(403).send({ messege: "forbiden access" })
            }

            const result = await usersCollection.findOne({ email: email })
            res.send(result)
        })


        // member apartment details
        app.get("/api/member/apartmentData", varifyToken, varifyMember, async (req, res) => {
            const id = req.query.id
            const result = await apartmentCollection.findOne({ _id: new ObjectId(id) })
            res.send(result)
        })







        // get user role

        app.get("/api/user/role", varifyToken, async (req, res) => {
            const email = req.query.email
            const result = await usersCollection.findOne({ email: email }, { projection: { _id: 0, role: 1 } })

            res.send(result)
        })



        // agreement req status changed
        app.put("/api/agreement/status", varifyToken, varifyAdmin, async (req, res) => {

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
        app.put("/api/user/role/update", varifyToken, varifyAdmin, async (req, res) => {
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


        // book the apartment
        app.put("/api/apartment/book", varifyToken, varifyAdmin, async (req, res) => {
            const role = req.query.role
            const apartmentId = req.query.id
            if (role !== "admin" || !role) {
                return res.status(401).send({ messege: "unAurhorized" })
            }

            const find = { _id: new ObjectId(apartmentId) }
            const update = {
                $set: {
                    booked: "true"
                }
            }

            const result = apartmentCollection.updateOne(find, update)
            res.send(result)
        })


        // dashboard details
        app.get("/api/dashboard/data", varifyToken, async (req, res) => {
            const total = await apartmentCollection.estimatedDocumentCount()
            const totalBooked = await apartmentCollection.find({ booked: "true" }).toArray()
            const totalUser = await usersCollection.find({ role: "user" }).toArray()
            const totalMember = await usersCollection.find({ role: "member" }).toArray()
            res.send({ total, totalBooked, totalBooked: totalBooked.length, totalUser: totalUser.length, totalMember: totalMember.length })
        })



        // add aptId to the user data
        app.put("/api/user/booked", varifyToken, async (req, res) => {
            const aptId = req.query.aptID
            const agreementDate = req.query.agreeDate
            const role = req.query.role
            const email = req.query.email
            if (role !== "admin" || !role) {
                return res.status(401).send({ messege: "unAurhorized" })
            }

            const find = { email: email }

            const update = {
                $set: {
                    apartment: aptId,
                    agreementDate: agreementDate
                }
            }

            const reult = await usersCollection.updateOne(find, update)
            res.send(reult)

        })



        // coupons
        app.get("/api/coupons", async (req, res) => {
            const result = await couponsCollection.find().toArray()
            res.send(result)
        })


        // change coupon validity
        app.put("/api/coupon/unactive", varifyToken, varifyAdmin, async (req, res) => {
            const id = req.query.id
            const find = { _id: new ObjectId(id) }

            const update = {
                $set: {
                    active: false
                }
            }

            const result = await couponsCollection.updateOne(find, update)
            res.send(result)
        })


        app.put("/api/coupon/active", varifyToken, varifyAdmin, async (req, res) => {
            const id = req.query.id
            const find = { _id: new ObjectId(id) }

            const update = {
                $set: {
                    active: true
                }
            }

            const result = await couponsCollection.updateOne(find, update)
            res.send(result)
        })



        // payment intent

        app.post("/api/paymentIntent", async (req, res) => {
            const { price } = req.body
            const amount = parseInt(price) * 100
            const { client_secret } = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            })

            res.send({ client_secret })
        })


        // get specific coupon code 
        app.get("/api/get/coupon", async (req, res) => {
            const code = req.query.code

            if (!code) {
                return res.send({ value: 0 })
            }

            const coupon = await couponsCollection.findOne({ coupon: code })
            if (!coupon) {
                return res.send({ invalid: true })
            }
            res.send(coupon)
        })




        // add payment history to db
        app.post("/api/payment/history", varifyToken, async (req, res) => {
            const body = req.body
            const result = await paymentHistoryCollection.insertOne(body)
            res.send(result)
        })


        //load specific users payment history
        app.get("/api/member/payments", varifyToken, varifyMember, async (req, res) => {
            const email = req.query.email
            if (!email) {
                return
            }

            if (req.user.email !== email) {
                return res.status(403).send({ message: "forbiden access" })

            }

            const find = { email: email }

            const result = await paymentHistoryCollection.find(find).toArray()

            res.send(result)
        })



        //get all coupon
        app.get("/api/all/coupon", async (req, res) => {
            const result = await couponsCollection.find({ active: true }).toArray()
            res.send(result)
        })


        //add coupon
        app.post("/api/add/coupon", varifyToken, varifyAdmin, async (req, res) => {
            const body = req.body
            const result = await couponsCollection.insertOne(body)
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