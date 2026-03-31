var express = require("express");
var router = express.Router();
let messageModel = require("../schemas/messages");
let { CheckLogin } = require("../utils/authHandler");
let { uploadFile } = require("../utils/uploadHandler");
let mongoose = require("mongoose");

router.use(CheckLogin);
router.get("/", async function (req, res, next) {
  try {
    let currentUserId = req.user._id;
    let messages = await messageModel
      .find({
        $or: [{ from: currentUserId }, { to: currentUserId }]
      })
      .sort({ createdAt: -1 })
      .populate("from", "username fullName avatarUrl")
      .populate("to", "username fullName avatarUrl");
    let groupedByUser = {};
    messages.forEach(msg => {
      let userId = msg.from._id.toString() === currentUserId.toString() 
        ? msg.to._id.toString() 
        : msg.from._id.toString();
      if (!groupedByUser[userId]) {
        groupedByUser[userId] = {
          _id: msg._id,
          from: msg.from,
          to: msg.to,
          messageContent: msg.messageContent,
          createdAt: msg.createdAt,
          userInfo: msg.from._id.toString() === currentUserId.toString() 
            ? msg.to 
            : msg.from
        };
      }
    });
    let result = Object.values(groupedByUser)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

router.get("/:userID", async function (req, res, next) {
  try {
    let currentUserId = req.user._id;
    let otherUserId = req.params.userID;

    let result = await messageModel
      .find({
        $or: [
          { from: currentUserId, to: otherUserId },
          { from: otherUserId, to: currentUserId },
        ],
      })
      .sort({ createdAt: 1 })
      .populate("from", "username fullName avatarUrl")
      .populate("to", "username fullName avatarUrl");

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});


router.post("/", uploadFile.single("file"), async function (req, res, next) {
  try {
    let currentUserId = req.user._id;
    let toUserId = req.body.to;

    if (!toUserId) {
      return res.status(400).send({ message: "Thiếu người nhận (to)" });
    }

    let messageContent;
    if (req.file) {
      messageContent = {
        type: "file",
        text: req.file.path,
      };
    } else if (req.body.text) {
      messageContent = {
        type: "text",
        text: req.body.text,
      };
    } else {
      return res.status(400).send({ message: "Thiếu nội dung tin nhắn" });
    }

    let newMessage = new messageModel({
      from: currentUserId,
      to: toUserId,
      messageContent: messageContent,
    });

    newMessage = await newMessage.save();
    newMessage = await newMessage.populate("from", "username fullName avatarUrl");
    newMessage = await newMessage.populate("to", "username fullName avatarUrl");

    res.send(newMessage);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

module.exports = router;
