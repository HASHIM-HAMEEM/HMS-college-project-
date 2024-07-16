const express = require("express");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const QRCode = require("qrcode");
const connection = require("../dbconnection");
const nodemailer = require("nodemailer");
// const mongoose = require("mongoose");

const multer = require("multer");
require("dotenv").config();
var uuid = require("uuid");

const { response, json, query } = require("express");
const { appendFile } = require("fs");

var router = express.Router();
router.use(cookieParser());

// flash message midelware
router.use((req, res, next) => {
  res.locals.message = req.session.message;
  delete req.session.message;
  next();
});

// Set up Multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/"); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// validate if Usser is  Loggedin
function validateLogin(req, res, next) {
  if (!req.session.loggedin) {
    req.session.message = {
      type: "danger",
      message: "Please Log in to continue",
    };
    res.redirect("/Login");
  } else {
    next();
  }
}

// send email Email  function
function sendEmail(email, esubject, etext) {
  let testAccount = nodemailer.createTestAccount();

  console.log(process.env.EMAIL + process.env.EMAIL_PASS);
  var transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,

    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS,
    },
  });

  var mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: esubject,
    text: etext,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

/* GET home page. */
const resultsPerPage = 20;
router.get("/", validateLogin, async function (req, res, next) {
  try {
    const db = await connectToDatabase();
    const studentsCollection = db.collection("student_registration");

    const totalCount = await studentsCollection.countDocuments({
      s_approved: "approved",
    });
    const numberOfPages = Math.ceil(totalCount / resultsPerPage);

    let page = req.query.page ? Number(req.query.page) : 1;
    if (page > numberOfPages) {
      return res.redirect("/?page=" + encodeURIComponent(numberOfPages));
    } else if (page < 1) {
      return res.redirect("/?page=" + encodeURIComponent("1"));
    }

    const startingLimit = (page - 1) * resultsPerPage;

    const students = await studentsCollection
      .find({ s_approved: "approved" })
      .skip(startingLimit)
      .limit(resultsPerPage)
      .toArray();

    let iterator = page - 5 < 1 ? 1 : page - 5;
    let endingLink =
      iterator + 9 <= numberOfPages
        ? iterator + 9
        : page + (numberOfPages - page);
    if (endingLink < page + 4) {
      iterator -= page + 4 - numberOfPages;
    }

    res.render("index", {
      title: "Admin Dashboard",
      data: students,
      page,
      iterator,
      endingLink,
      numberOfPages,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).send("An error occurred. Please try again.");
  }
});

//login page
router.get("/Login", function (req, res, next) {
  res.render("login", {
    title: "LogIn Page",
    code1: res.statusCode,
  });
  // console.log("statusCode: ", res.statusCode);
});

//Login POST
const { connectToDatabase } = require("../dbconnection");
router.post("/Login", async function (request, response) {
  // Capture the input fields
  let email = request.body.email;
  let password = request.body.password;

  // Ensure the input fields exists and are not empty
  if (email && password) {
    try {
      const db = await connectToDatabase();
      const adminsCollection = db.collection("admins");

      // Find the employee in the database
      const admins = await adminsCollection.findOne({
        a_email: email,
        a_password: password,
      });

      if (admins) {
        // Authenticate the user
        request.session.loggedin = true;
        request.session.email = email;
        request.session.message = {
          type: "success",
          message: "Logged in Successfully",
        };
        // Redirect to home page
        return response.redirect("/");
      } else {
        request.session.message = {
          type: "danger",
          message: "Invalid Email or Password",
        };
        return response.redirect("/Login");
      }
    } catch (error) {
      console.error("Database error:", error);
      request.session.message = {
        type: "danger",
        message: "An error occurred. Please try again.",
      };
      return response.redirect("/Login");
    }
  } else {
    request.session.message = {
      type: "danger",
      message: "Please enter Required data",
    };
    return response.redirect("/Login");
  }
});

//LOG OUT
router.get("/logout", function (req, res, next) {
  if (req.session) {
    req.session.destroy(function (err) {
      if (err) {
        return next(err);
      } else {
        res.status(400);
        return res.redirect("/Login");
      }
    });
  }
});

// Pending students
router.get("/Pending_Students", validateLogin, async function (req, res, next) {
  try {
    const db = await connectToDatabase();
    const studentCollection = db.collection("student_registration");
    const result = await studentCollection
      .find({ s_approved: "pending" })
      .toArray();
    res.render("pages/pending_students", {
      title: "Pending Students",
      data1: result,
    });
  } catch (error) {
    next(error);
  }
});

// Pending student details Rollno
router.get(
  "/Pending_Students/:rollno",
  validateLogin,
  async function (req, res, next) {
    try {
      const db = await connectToDatabase();
      const studentCollection = db.collection("student_registration");
      const result = await studentCollection.findOne({
        s_rollno: req.params.rollno,
      });
      res.render("pages/pending_student_details", {
        title: "Pending Student Details",
        data2: [result], // Wrapping in array to maintain compatibility with existing view
      });
    } catch (error) {
      next(error);
    }
  }
);

// Pending student details Rollno POST
router.post(
  "/Pending_Students/:rollno",
  validateLogin,
  async function (req, res, next) {
    try {
      const db = await connectToDatabase();
      const studentCollection = db.collection("student_registration");
      const walletCollection = db.collection("walle_table");
      const transactionCollection = db.collection("transiction_log");

      if (req.body.allow == "allow") {
        const student = await studentCollection.findOne({
          s_rollno: req.params.rollno,
        });
        const qrdata = `${student.s_rollno}:${student.s_name}:${student.s_phone}`;
        const qrcodeStr = await QRCode.toDataURL(qrdata);

        await studentCollection.updateOne(
          { s_rollno: req.params.rollno },
          {
            $set: {
              s_status: "active",
              s_approved: "approved",
              s_note_emp: req.body.note,
              s_hostal_details: req.body.hostal_details,
              s_qrcode: qrcodeStr,
            },
          }
        );

        await walletCollection.insertOne({
          student_id: req.params.rollno,
          amount: 0,
          remark: "none",
        });

        sendEmail(
          student.s_email,
          "KGP SRINAGAR HOSTEL",
          "You have been selected in our college hostel"
        );

        req.session.message = {
          type: "success",
          message: "Student Approved !!",
        };
      } else {
        await studentCollection.updateOne(
          { s_rollno: req.params.rollno },
          {
            $set: {
              s_status: "discard",
              s_approved: "discard",
              s_note_emp: req.body.note,
            },
          }
        );

        sendEmail(
          req.body.s_email,
          "KGP SRINAGAR HOSTEL",
          `Sorry!! You are not selected in our college hostel because of the reason: ${req.body.note}`
        );

        req.session.message = {
          type: "danger",
          message: "Student Discarded!!",
        };
      }

      res.redirect("/Pending_Students");
    } catch (error) {
      next(error);
    }
  }
);

// Student details in card form with qr code
router.get(
  "/Student-Details/:rollno",
  validateLogin,
  async function (req, res, next) {
    try {
      const db = await connectToDatabase();
      const studentCollection = db.collection("student_registration");
      const transactionCollection = db.collection("transiction_log");
      const walletCollection = db.collection("walle_table");

      const student = await studentCollection.findOne({
        s_rollno: req.params.rollno,
      });
      const transactions = await transactionCollection
        .find({ student_id: req.params.rollno })
        .toArray();
      const wallet = await walletCollection.findOne({
        student_id: req.params.rollno,
      });

      res.render("pages/student_details.ejs", {
        title: "Student Details",
        data3: [student], // Wrapping in array to maintain compatibility with existing view
        amount: wallet ? wallet.amount : 0,
        trandata: transactions,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Edit student with roll no
router.get("/Edit_Student/:rollno", validateLogin, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const studentCollection = db.collection("student_registration");
    const student = await studentCollection.findOne({
      s_rollno: req.params.rollno,
    });
    res.render("pages/edit_student", {
      title: "Edit Student Details",
      data2: [student], // Wrapping in array to maintain compatibility with existing view
    });
  } catch (error) {
    next(error);
  }
});

// Edit student with roll no POST
router.post("/Edit_Student/:rollno", validateLogin, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const studentCollection = db.collection("student_registration");
    await studentCollection.updateOne(
      { s_rollno: req.params.rollno },
      {
        $set: {
          s_rollno: req.body.rollno,
          s_name: req.body.fname,
          s_parentage: req.body.parentage,
          s_phone: req.body.phno,
          s_batch: req.body.batch,
          s_branch: req.body.branch,
          s_p_phone: req.body.p_phno,
          s_email: req.body.email,
          s_hostal_details: req.body.hostal_details,
          s_password_hash: req.body.password,
          s_note_emp: req.body.note,
        },
      }
    );
    req.session.message = {
      type: "success",
      message: "Student Updated !!",
    };
    res.redirect("/Student-Details/" + req.body.rollno);
  } catch (error) {
    next(error);
  }
});

//add money
router.get("/Add_Money/:rollno", validateLogin, (req, res, next) => {
  res.render("pages/add_money", {
    title: "Add Money",
    puser: req.params.rollno,
  });
});

// Add money POST
router.post("/Add_Money/:rollno", validateLogin, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const walletCollection = db.collection("walle_table");
    const transactionCollection = db.collection("transiction_log");

    await walletCollection.updateOne(
      { student_id: req.params.rollno },
      { $inc: { amount: Number(req.body.amount) } }
    );

    const Tid = uuid.v4();
    await transactionCollection.insertOne({
      student_id: req.params.rollno,
      dt_ct: "ct",
      transiction_id: `${req.params.rollno}-UHFTA-${Tid}`,
      amount: Number(req.body.amount),
    });

    req.session.message = {
      type: "success",
      message: "Amount Added !!",
    };
    res.redirect("/Student-Details/" + req.params.rollno);
  } catch (error) {
    next(error);
  }
});

// Edit status POST
router.post("/edit_status/:rollno", validateLogin, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const studentCollection = db.collection("student_registration");
    await studentCollection.updateOne(
      { s_rollno: req.params.rollno },
      { $set: { s_status: req.body.status } }
    );
    req.session.message = {
      type: "success",
      message: "Student Updated Successfully",
    };
    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

// For searching student
router.get("/search", validateLogin, async function (req, res, next) {
  try {
    const db = await connectToDatabase();
    const studentCollection = db.collection("student_registration");
    const students = await studentCollection
      .find(
        { s_rollno: { $regex: req.query.search, $options: "i" } },
        { projection: { s_rollno: 1, s_name: 1 } }
      )
      .toArray();

    const data = students.map((student) => student.s_name);
    res.render("pages/test", { data: JSON.stringify(data) });
  } catch (error) {
    next(error);
  }
});

// Print_Card
router.get("/Print_Card/:rollno", validateLogin, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const studentCollection = db.collection("student_registration");
    const student = await studentCollection.findOne(
      { s_rollno: req.params.rollno },
      {
        projection: {
          s_name: 1,
          s_rollno: 1,
          s_phone: 1,
          s_email: 1,
          s_qrcode: 1,
        },
      }
    );
    res.render("pages/qrcard", {
      title: "QR Card",
      data5: [student], // Wrapping in array to maintain compatibility with existing view
    });
  } catch (error) {
    next(error);
  }
});

// Discarded_Students
router.get("/Discarded_Students", validateLogin, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const studentCollection = db.collection("student_registration");
    const discardedStudents = await studentCollection
      .find({ s_approved: "discard" })
      .toArray();
    res.render("pages/discarded_students", {
      title: "Discarded Students",
      data: discardedStudents,
    });
  } catch (error) {
    next(error);
  }
});

// Delete student
router.get("/Delete_Student/:rollno", validateLogin, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const studentCollection = db.collection("student_registration");
    await studentCollection.deleteOne({ s_rollno: req.params.rollno });
    req.session.message = {
      type: "danger",
      message: "Student deleted !!",
    };
    res.redirect("/Discarded_Students");
  } catch (error) {
    next(error);
  }
});

// Email services
router.get("/Email_Service", validateLogin, (req, res, next) => {
  res.render("pages/email_services", {
    title: "Email Services ",
  });
});

// Email services POST
router.post("/Email_Service", async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const studentCollection = db.collection("student_registration");
    const activeStudents = await studentCollection
      .find({ s_status: "active" }, { projection: { s_email: 1 } })
      .toArray();
    const maillist = activeStudents.map((student) => student.s_email);

    await sendEmail(maillist, req.body.esubject, req.body.econtent);

    req.session.message = {
      type: "success",
      message: "Email Sent To All Students Successfully !!",
    };
    res.redirect("/Email_Service");
  } catch (error) {
    next(error);
  }
});

// Add student GET
router.get("/add_student", validateLogin, (req, res, next) => {
  res.render("pages/add_student", {
    title: "Add Student ",
  });
});

// ADD student POST

router.post("/Add_Student", upload.single("simage"), async (req, res) => {
  try {
    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }
    // Connect to the database
    const db = await connectToDatabase();
    const studentsCollection = db.collection("StudentDetails");

    // Create new student object
    const newStudent = {
      s_name: req.body.sname,
      s_status: req.body.usn,
      s_email: req.body.semail,
      s_address: req.body.saddress,
      s_phone: req.body.sphone,
      s_dob: new Date(req.body.sdob),
      s_roomNo: req.body.sroomNo,
      s_parantage: req.body.sparantage,
      s_image: `/uploads/${req.file.filename}`, // Save the path to the image
    };
    console.log(newStudent);
    // Insert the new student into the database
    const result = await studentsCollection.insertOne(newStudent);
    if (result.acknowledged) {
      // Redirect to a success page or send a success response
      res.status(201).send("Student added successfully");
    } else {
      throw new Error("Failed to insert student");
    }
  } catch (error) {
    console.error("Error adding student:", error);
    if (error.code === 11000) {
      // Duplicate key error
      res.status(400).send("A student with this USN or email already exists.");
    } else {
      res.status(500).send("Error adding student. Please try again.");
    }
  }
});

module.exports = router;
