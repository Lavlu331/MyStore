const pool = require('../config/db');
const { getSettings } = require('../utils/pricing');

// PUBLIC: shown in the cart (delivery charge and free-delivery threshold)
exports.publicSettings = async (req, res, next) => {
  try { res.json(await getSettings(pool)); } catch (err) { next(err); }
};

exports.get = exports.publicSettings;

// PUT { delivery_charge, free_delivery_threshold }   (0 = no charge / no free threshold)
exports.update = async (req, res, next) => {
  try {
    const out = {};
    for (const key of ['delivery_charge', 'free_delivery_threshold']) {
      if (req.body[key] === undefined) continue;
      const value = req.body[key];
      if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '')
        return res.status(400).json({ message: `${key.replaceAll('_', ' ')} is required and must be a number` });
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ message: `${key.replaceAll('_', ' ')} must be 0 or more` });
      out[key] = n.toFixed(2);
    }
    if (!Object.keys(out).length) return res.status(400).json({ message: 'Nothing to update' });
    for (const [k, v] of Object.entries(out)) {
      await pool.execute(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [k, v]);
    }
    res.json(await getSettings(pool));
  } catch (err) { next(err); }
};
