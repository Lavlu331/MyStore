CREATE TABLE IF NOT EXISTS admin_user_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  actor_id INT NOT NULL,
  previous_role VARCHAR(32) NOT NULL,
  new_role VARCHAR(32) NOT NULL,
  previous_active TINYINT(1) NOT NULL,
  new_active TINYINT(1) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_user_audit_target (user_id, id)
) ENGINE=InnoDB;
