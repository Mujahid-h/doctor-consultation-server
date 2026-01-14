const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { authenticate, requireRole } = require("../middleware/auth");
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const Appointment = require("../modal/Appointment");
const Doctor = require("../modal/Doctor");
const Patient = require("../modal/Patient");

const router = express.Router();

router.post(
  "/create-order",
  authenticate,
  requireRole("patient"),
  [
    body("doctorId").isMongoId().withMessage("valid doctor ID is required"),
    body("slotStartIso")
      .isISO8601()
      .withMessage("valid start time is required"),
    body("slotEndIso").isISO8601().withMessage("valid end time is required"),
    body("consultationType")
      .isIn(["Video Consultation", "Voice Call"])
      .withMessage("valid consultation type required"),
    body("symptoms")
      .isString()
      .trim()
      .withMessage("symptoms description is required"),
    body("consultationFees")
      .isNumeric()
      .withMessage("consultationFees is required"),
    body("platformFees").isNumeric().withMessage("platformFees is required"),
    body("totalAmount").isNumeric().withMessage("totalAmount is required"),
    body("date").isString().withMessage("date is required"),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        doctorId,
        slotStartIso,
        slotEndIso,
        date,
        consultationType,
        symptoms,
        consultationFees,
        platformFees,
        totalAmount,
      } = req.body;

      // Check for conflicting appointments
      const conflictingAppointment = await Appointment.findOne({
        doctorId,
        status: { $in: ["Scheduled", "In Progress"] },
        $or: [
          {
            slotStartIso: { $lt: new Date(slotEndIso) },
            slotEndIso: { $gt: new Date(slotStartIso) },
          },
        ],
      });

      if (conflictingAppointment) {
        return res.forbidden("This time slot is already booked");
      }

      // Get doctor and patient info for metadata
      const doctor = await Doctor.findById(doctorId).select(
        "name specialization"
      );
      const patient = await Patient.findById(req.auth.id).select(
        "name email phone"
      );

      if (!doctor) {
        return res.notFound("Doctor not found");
      }
      if (!patient) {
        return res.notFound("Patient not found");
      }

      // Create Stripe Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents/paisa
        currency: "pkr",
        metadata: {
          doctorId: doctorId,
          patientId: req.auth.id,
          doctorName: doctor.name,
          patientName: patient.name,
          consultationType: consultationType,
          date: date,
          slotStart: slotStartIso,
          slotEnd: slotEndIso,
          symptoms: symptoms.substring(0, 500), // Stripe metadata has size limits
          consultationFees: consultationFees.toString(),
          platformFees: platformFees.toString(),
          totalAmount: totalAmount.toString(),
        },
        description: `Consultation with Dr. ${doctor.name}`,
      });

      res.ok(
        {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: totalAmount,
          currency: "PKR",
        },
        "Payment intent created successfully"
      );
    } catch (error) {
      res.serverError("Failed to create payment order ", [error.message]);
    }
  }
);

router.post(
  "/verify-payment",
  authenticate,
  requireRole("patient"),
  [
    body("paymentIntentId")
      .isString()
      .withMessage("Stripe payment intent ID required"),
  ],
  validate,
  async (req, res) => {
    try {
      const { paymentIntentId } = req.body;

      // Verify payment with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId
      );

      if (paymentIntent.status !== "succeeded") {
        return res.badRequest("Payment not completed or failed");
      }

      // Verify the patient ID matches
      if (paymentIntent.metadata.patientId !== req.auth.id) {
        return res.forbidden("Access denied");
      }

      // Check if appointment already exists (in case of retry)
      let appointment = await Appointment.findOne({
        stripePaymentIntentId: paymentIntentId,
      });

      if (appointment) {
        // Appointment already created, just return it
        await appointment.populate(
          "doctorId",
          "name specialization fees hospitalInfo profileImage"
        );
        await appointment.populate(
          "patientId",
          "name email phone profileImage"
        );
        return res.ok(
          appointment,
          "Payment verified and appointment confirmed successfully"
        );
      }

      // Check for conflicting appointments before creating
      const conflictingAppointment = await Appointment.findOne({
        doctorId: paymentIntent.metadata.doctorId,
        status: { $in: ["Scheduled", "In Progress"] },
        $or: [
          {
            slotStartIso: { $lt: new Date(paymentIntent.metadata.slotEnd) },
            slotEndIso: { $gt: new Date(paymentIntent.metadata.slotStart) },
          },
        ],
      });

      if (conflictingAppointment) {
        // Payment succeeded but slot is now taken - refund should be handled separately
        return res.badRequest(
          "Time slot is no longer available. Please contact support for refund."
        );
      }

      // Create appointment after successful payment
      const zegoRoomId = `room_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      appointment = new Appointment({
        doctorId: paymentIntent.metadata.doctorId,
        patientId: req.auth.id,
        date: new Date(paymentIntent.metadata.date),
        slotStartIso: new Date(paymentIntent.metadata.slotStart),
        slotEndIso: new Date(paymentIntent.metadata.slotEnd),
        consultationType: paymentIntent.metadata.consultationType,
        symptoms: paymentIntent.metadata.symptoms,
        zegoRoomId,
        status: "Scheduled",
        consultationFees: parseFloat(paymentIntent.metadata.consultationFees),
        platformFees: parseFloat(paymentIntent.metadata.platformFees),
        totalAmount: parseFloat(paymentIntent.metadata.totalAmount),
        paymentStatus: "Paid",
        payoutStatus: "Pending",
        paymentMethod: "Stripe",
        stripePaymentIntentId: paymentIntentId,
        stripeChargeId: paymentIntent.latest_charge || null,
        paymentDate: new Date(),
      });

      await appointment.save();

      await appointment.populate(
        "doctorId",
        "name specialization fees hospitalInfo profileImage"
      );
      await appointment.populate("patientId", "name email phone profileImage");

      res.ok(
        appointment,
        "Payment verified and appointment confirmed successfully"
      );
    } catch (error) {
      res.serverError("Failed to verify payment ", [error.message]);
    }
  }
);

module.exports = router;
