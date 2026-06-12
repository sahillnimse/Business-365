import { userInitials } from "@/lib/user";

const sizeClasses = {
  sm: "h-7 w-7 text-xs rounded-md",
  md: "h-9 w-9 text-sm rounded-lg",
  lg: "h-11 w-11 text-base rounded-xl",
  xl: "h-24 w-24 text-3xl rounded-2xl",
};

export function UserAvatar({ user, name, size = "md", className = "" }) {
  const initials = userInitials(user);
  const photo = user?.photo_url;
  const alt = name ?? user?.name ?? user?.email ?? "User";

  return (
    <div
      className={`profile-avatar flex shrink-0 items-center justify-center overflow-hidden font-semibold ${sizeClasses[size]} ${className}`}
      aria-hidden={!photo}
    >
      {photo ? (
        <img src={photo} alt={alt} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
