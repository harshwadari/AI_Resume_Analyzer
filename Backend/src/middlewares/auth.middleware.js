const jwt = require("jsonwebtoken")
const tokenBlackListModel = require("../models/blacklist.model")

async function authUser(req, res, next) {
    try {
        //  Read token from cookie OR Authorization header (for Postman)
        const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1]

        if (!token) {
            return res.status(401).json({
                message: "Unauthorized, token not found"
            })
        }

        //  Fixed logic — block if token IS blacklisted
        const isTokenBlackListed = await tokenBlackListModel.findOne({ token })
        if (isTokenBlackListed) {
            return res.status(401).json({
                message: "Unauthorized, token is blacklisted"
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        next()

    } catch (err) {
        return res.status(401).json({
            message: "Unauthorized, invalid token"
        })
    }
}

module.exports = { authUser }