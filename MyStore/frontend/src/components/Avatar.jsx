// Profile photo, or the first letter of the name on an orange circle
export default function Avatar({ user, size = 'h-10 w-10', text = 'text-base', ring = '' }) {
  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt="" className={`${size} ${ring} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span className={`${size} ${text} ${ring} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 font-bold text-white`}>
      {(user?.name || '?').charAt(0).toUpperCase()}
    </span>
  );
}
