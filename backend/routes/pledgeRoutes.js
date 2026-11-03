/**
 * pledgeRoutes.js
 * ───────────────
 * Pledge Campaign module routes
 * Ref: BSS-KKKT-2026-003
 *
 * Mount in app.js / server.js:
 *   const pledgeRoutes = require('./routes/pledgeRoutes');
 *   app.use('/api/pledges', pledgeRoutes);
 *
 * Route overview
 * ──────────────────────────────────────────────────────────────────
 * Pledge Types (catalogue)
 *   GET    /api/pledges/types
 *
 * Campaigns
 *   GET    /api/pledges/campaigns            list all campaigns
 *   POST   /api/pledges/campaigns            create a campaign
 *   GET    /api/pledges/campaigns/:id        get one campaign
 *   PUT    /api/pledges/campaigns/:id        update campaign meta
 *   DELETE /api/pledges/campaigns/:id        soft-delete campaign
 *
 * Member pledges (subscriptions to a campaign)
 *   GET    /api/pledges/campaigns/:id/members      list all pledges in campaign
 *   POST   /api/pledges/campaigns/:id/members      subscribe a member to campaign
 *   GET    /api/pledges/members/:userId            all pledges for one member
 *   PUT    /api/pledges/member-pledges/:pledgeId   edit a member's pledge
 *   DELETE /api/pledges/member-pledges/:pledgeId   delete a member's pledge
 *
 * Payments (installments)
 *   GET    /api/pledges/member-pledges/:pledgeId/payments   list payments
 *   POST   /api/pledges/member-pledges/:pledgeId/payments   record a payment
 *   DELETE /api/pledges/payments/:paymentId                 delete a payment
 *
 * Reporting
 *   GET    /api/pledges/report   ?year=&campaign_id=&group_id=&is_fulfilled=&scope=
 * ──────────────────────────────────────────────────────────────────
 */

const router  = require('express').Router();
const { body, param, query } = require('express-validator');
const validate   = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/pledgeController');

// ── All pledge routes require authentication ──────────────────────────────────
router.use(authenticate);

// ── Pledge types (catalogue) ──────────────────────────────────────────────────
router.get('/types', ctrl.getPledgeTypes);

// ── Reporting ─────────────────────────────────────────────────────────────────
router.get(
  '/report',
  authorize('pastor', 'elder', 'group_leader'),
  [
    query('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('year must be a valid year'),
    query('campaign_id').optional().isInt({ min: 1 }).withMessage('campaign_id must be a positive integer'),
    query('group_id').optional().isInt({ min: 1 }).withMessage('group_id must be a positive integer'),
    query('is_fulfilled').optional().isIn(['0', '1']).withMessage('is_fulfilled must be 0 or 1'),
    query('scope').optional().isIn(['church', 'group', 'member']).withMessage('scope must be church | group | member'),
  ],
  validate,
  ctrl.getReport
);

// ── Campaigns ─────────────────────────────────────────────────────────────────
router.get(
  '/campaigns',
  authorize('pastor', 'elder', 'group_leader'),
  ctrl.getCampaigns
);

router.post(
  '/campaigns',
  authorize('pastor', 'elder', 'group_leader'),
  [
    body('name').trim().notEmpty().withMessage('Campaign name is required'),
    body('pledge_type_id').isInt({ min: 1 }).withMessage('pledge_type_id must be a positive integer'),
    body('pledge_year')
      .isInt({ min: 2000, max: 2100 })
      .withMessage('pledge_year must be a valid year (2000–2100)'),
    body('scope')
      .isIn(['church', 'group', 'member'])
      .withMessage('scope must be church | group | member'),
    body('group_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('group_id must be a positive integer'),
    body('member_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('member_id must be a positive integer'),
    body('target_amount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('target_amount must be a non-negative number'),
    body('start_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('start_date must be a valid date (YYYY-MM-DD)'),
    body('end_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('end_date must be a valid date (YYYY-MM-DD)'),
  ],
  validate,
  ctrl.createCampaign
);

router.get(
  '/campaigns/:id',
  authorize('pastor', 'elder', 'group_leader'),
  [param('id').isInt({ min: 1 }).withMessage('Campaign id must be a positive integer')],
  validate,
  ctrl.getCampaign
);

router.put(
  '/campaigns/:id',
  authorize('pastor', 'elder', 'group_leader'),
  [
    param('id').isInt({ min: 1 }).withMessage('Campaign id must be a positive integer'),
    body('target_amount').optional().isFloat({ min: 0 }).withMessage('target_amount must be a non-negative number'),
    body('start_date').optional({ nullable: true }).isISO8601().withMessage('start_date must be YYYY-MM-DD'),
    body('end_date').optional({ nullable: true }).isISO8601().withMessage('end_date must be YYYY-MM-DD'),
    body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  ],
  validate,
  ctrl.updateCampaign
);

router.delete(
  '/campaigns/:id',
  authorize('pastor', 'elder'),
  [param('id').isInt({ min: 1 }).withMessage('Campaign id must be a positive integer')],
  validate,
  ctrl.deleteCampaign
);

// ── Member pledges per campaign ───────────────────────────────────────────────
router.get(
  '/campaigns/:id/members',
  authorize('pastor', 'elder', 'group_leader'),
  [param('id').isInt({ min: 1 })],
  validate,
  ctrl.getCampaignPledges
);

router.post(
  '/campaigns/:id/members',
  authorize('pastor', 'elder', 'group_leader'),
  [
    param('id').isInt({ min: 1 }).withMessage('Campaign id must be a positive integer'),
    body('member_id').isInt({ min: 1 }).withMessage('member_id is required'),
    body('annual_amount')
      .isFloat({ min: 1 })
      .withMessage('annual_amount must be greater than 0'),
    body('pledge_number')
      .optional({ nullable: true })
      .isString()
      .withMessage('pledge_number must be a string'),
    body('signed_date')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('signed_date must be YYYY-MM-DD'),
  ],
  validate,
  ctrl.addMemberPledge
);

// ── All pledges for one member ────────────────────────────────────────────────
router.get(
  '/members/:userId',
  [param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer')],
  validate,
  ctrl.getMemberPledges
);

// ── Edit / delete a specific member pledge ────────────────────────────────────
router.put(
  '/member-pledges/:pledgeId',
  authorize('pastor', 'elder', 'group_leader'),
  [
    param('pledgeId').isInt({ min: 1 }),
    body('annual_amount').optional().isFloat({ min: 1 }).withMessage('annual_amount must be greater than 0'),
    body('is_fulfilled').optional().isBoolean(),
  ],
  validate,
  ctrl.updateMemberPledge
);

router.delete(
  '/member-pledges/:pledgeId',
  authorize('pastor', 'elder'),
  [param('pledgeId').isInt({ min: 1 })],
  validate,
  ctrl.deleteMemberPledge
);

// ── Payments (installments) ───────────────────────────────────────────────────
router.get(
  '/member-pledges/:pledgeId/payments',
  [param('pledgeId').isInt({ min: 1 })],
  validate,
  ctrl.getPayments
);

router.post(
  '/member-pledges/:pledgeId/payments',
  authorize('pastor', 'elder', 'group_leader'),
  [
    param('pledgeId').isInt({ min: 1 }).withMessage('pledgeId must be a positive integer'),
    body('amount').isFloat({ min: 0.01 }).withMessage('amount must be greater than 0'),
    body('payment_date').isISO8601().withMessage('payment_date is required (YYYY-MM-DD)'),
    body('payment_method')
      .optional()
      .isIn(['cash', 'bank_transfer', 'mobile_money', 'cheque'])
      .withMessage('payment_method must be cash | bank_transfer | mobile_money | cheque'),
    body('receipt_number').optional({ nullable: true }).isString(),
  ],
  validate,
  ctrl.addPayment
);

router.delete(
  '/payments/:paymentId',
  authorize('pastor', 'elder'),
  [param('paymentId').isInt({ min: 1 })],
  validate,
  ctrl.deletePayment
);

module.exports = router;