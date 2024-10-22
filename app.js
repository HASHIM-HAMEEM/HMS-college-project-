const express = require("express");
const path = require("path");
const session = require("express-session");
const connectToDatabase = require('./mongoose-connect');
const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
const Routes = require("./routes/routes");
app.use(express.static(__dirname + "/public"));

const studentsRoute = require('./routes/api/students');
const messRoute = require('./routes/api/mess');

// session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: true,
    saveUninitialized: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectToDatabase();

// routes
app.use("/", Routes);
app.use("/Login", Routes);
app.use("/Pending_Students", Routes);
app.use("/Discarded_Students", Routes);
app.use("/Pending_Students/:rollno", Routes);
app.use("/Student-Details/:rollno", Routes);
app.use("/Edit_Student/:rollno", Routes);
app.use("/Add_Money/:rollno", Routes);
app.use("/edit_status/:rollno", Routes);
app.use("/search", Routes);
app.use("/Print_Card/:rollno", Routes);
app.use("/Print/:rollno", Routes);
app.use("/Delete_Student/:rollno", Routes);
app.use("/Email_Service", Routes);

// API routes
app.use("/api/students", studentsRoute);
app.use("/api/mess", messRoute);

app.listen(port, () => {
  console.log(`HMS app listening on port http://localhost:${port}`);
});