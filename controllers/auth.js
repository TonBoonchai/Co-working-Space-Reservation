const User = require("../models/User");
const google = require("../utils/googleOAuth");

// Holds the state and the PKCE verifier of one Google login attempt
const OAUTH_COOKIE = "googleOAuth";
const OAUTH_COOKIE_PATH = "/api/v1/auth/google";

//@desc     Register user
//@route    POST /api/v1/auth/register
//@access   Public
exports.register = async (req, res, next) => {
  try {
    const { name, tel, email, password, role } = req.body;

    // Create user
    const user = await User.create({
      name,
      tel,
      email,
      password,
      role,
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    console.log(err.stack);

    // Duplicate email
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: "This email is already registered" });
    }

    // Validation errors (missing name, invalid Thai telephone number, ...)
    if (err.name === "ValidationError") {
      const message = Object.values(err.errors)
        .map((e) => e.message)
        .join(", ");
      return res.status(400).json({ success: false, message });
    }

    res.status(400).json({ success: false, message: "Cannot register user" });
  }
};

//@desc     Login user
//@route    POST /api/v1/auth/login
//@access   Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, msg: "Please provide an email and password" });
    }

    // Check for user
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res
        .status(400)
        .json({ success: false, msg: "Invalid credentials" });
    }

    // A Google account has no password
    if (!user.password) {
      return res
        .status(401)
        .json({ success: false, msg: "Invalid credentials" });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, msg: "Invalid credentials" });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    return res.status(401).json({
      success: false,
      msg: "Cannot convert email or password to string",
    });
  }
};

//@desc     Start Google login (OAuth 2.0)
//@route    GET /api/v1/auth/google
//@access   Public
exports.googleLogin = (req, res, next) => {
  if (!google.isConfigured()) {
    return res
      .status(503)
      .json({ success: false, message: "Google login is not configured" });
  }

  const { state, verifier, url } = google.createLoginAttempt();

  res
    .cookie(OAUTH_COOKIE, `${state}.${verifier}`, {
      path: OAUTH_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      // "lax" sends the cookie when Google redirects the browser back
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    .redirect(302, url);
};

//@desc     Finish Google login, register the user on the first login
//@route    GET /api/v1/auth/google/callback
//@access   Public
exports.googleCallback = async (req, res, next) => {
  const [savedState, verifier] = (req.cookies[OAUTH_COOKIE] || "").split(".");
  res.clearCookie(OAUTH_COOKIE, { path: OAUTH_COOKIE_PATH });

  const { code, state, error } = req.query;

  if (!savedState || !verifier || !google.sameString(state, savedState)) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired Google login. Please start again",
    });
  }

  if (error || typeof code !== "string" || !code) {
    return res
      .status(400)
      .json({ success: false, message: "Google login was cancelled" });
  }

  if (!google.isConfigured()) {
    return res
      .status(503)
      .json({ success: false, message: "Google login is not configured" });
  }

  let profile;
  try {
    profile = await google.getProfile(code, verifier);
  } catch (err) {
    console.log(err.stack);
    return res
      .status(401)
      .json({ success: false, message: "Google rejected the login" });
  }

  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    return res.status(401).json({
      success: false,
      message: "The Google account has no verified email",
    });
  }

  try {
    let user = await User.findOne({ googleId: profile.sub });

    if (!user) {
      // Do not link to an account that registered with a password. This API
      // does not verify emails, so that account may belong to another person.
      if (await User.exists({ email: profile.email })) {
        return res.status(409).json({
          success: false,
          message:
            "This email is already registered. Please log in with your password",
        });
      }

      user = await User.create({
        name: profile.name || profile.email.split("@")[0],
        email: profile.email,
        googleId: profile.sub,
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    console.log(err.stack);

    // Two first logins with the same Google account at the same time
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered",
      });
    }

    res.status(500).json({ success: false, message: "Cannot log in with Google" });
  }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") {
    options.secure = true;
  }

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    //add for frontend
    _id: user._id,
    name: user.name,
    tel: user.tel,
    email: user.email,
    role: user.role,
    //end for frontend
    token,
  });
};

//@desc     Get current Logged in user
//@route    GET /api/v1/auth/me
//@access   Private
exports.getMe = async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({
    success: true,
    data: user,
  });
};

//@desc     Log user out / clear cookie
//@route    GET /api/v1/auth/logout
//@access   Private
exports.logout = async (req, res, next) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    data: {},
  });
};
