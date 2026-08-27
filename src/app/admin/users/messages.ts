export const USER_MANAGEMENT_ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "Enter a valid email address.",
  invalid_name: "Display name must be 80 characters or fewer.",
  invalid_password: "Temporary passwords must be 12 to 128 characters.",
  invalid_role: "Select Member, Contributor, or Administrator.",
  invalid_status: "Select an active or disabled status.",
  duplicate_email: "An account with that email already exists.",
  permission_denied: "You may not manage that account or assign that role.",
  missing_user: "That application user no longer exists.",
  final_owner: "The final active Owner cannot be disabled or demoted.",
  confirmation_required: "Confirm the account change before submitting.",
  service_unavailable: "Account administration is not configured on this server.",
  account_creation_failed: "The account could not be created.",
  creation_recovery_required:
    "Account creation could not be completed or fully rolled back. Check Supabase Auth before retrying.",
  reenable_failed: "The account could not be re-enabled in authentication.",
  password_reset_failed: "The temporary password could not be set.",
  operation_failed: "The account change could not be completed.",
  invalid_visibility: "Select Private beta or Public.",
  visibility_update_failed: "Site visibility could not be changed.",
};

export const USER_MANAGEMENT_SUCCESS_MESSAGES: Record<string, string> = {
  user_created: "Account created.",
  role_changed: "Role updated.",
  user_disabled: "Account disabled and authentication blocked.",
  user_disabled_session_warning:
    "Account disabled. Existing requests are blocked, but authentication session revocation needs attention.",
  user_reenabled: "Account re-enabled.",
  password_reset: "Temporary password updated. Share it outside the application.",
  visibility_private_beta: "Site visibility changed to Private beta.",
  visibility_public: "Site visibility changed to Public.",
};
