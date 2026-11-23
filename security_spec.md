# Blood App Security Specification (Phase 0)

## 1. Data Invariants
1. **Donor PII Isolation**: A `DonorProfile` at `/donors/{userId}` (which contains private `phone` and `lastDonationDate`) and `DonationLog` records at `/donors/{userId}/donations/{donationId}` are strictly readable and writable only by `userId` (`request.auth.uid == userId` with verified email).
2. **Request Ownership & Public Feed**: A `BloodRequest` at `/requests/{requestId}` may only be created by an authenticated, email-verified user with `requesterId == request.auth.uid`, `unitsPledged == 0`, `status == 'open'`, and server timestamps (`createdAt == request.time`, `updatedAt == request.time`). No PII fields (`phone`, `email`) are permitted on `/requests`.
3. **Terminal State Locking**: Once a `BloodRequest` reaches `status == 'fulfilled'` or `status == 'cancelled'`, no subsequent updates are allowed.
4. **Atomic Donor Pledging**: A donor pledge at `/requests/{requestId}/pledges/{pledgeId}` MUST use `pledgeId == request.auth.uid`, MUST target an `open` parent request (`get(...).data.status == 'open'`), and MUST atomically increment `unitsPledged` on the parent request via `writeBatch` (`getAfter` / `existsAfter` enforcement).
5. **Immutable Identity & Creation Timestamps**: `uid`, `userId`, `requesterId`, `donorId`, `requestId`, and `createdAt` can never be mutated on update.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: `GET /requests/req-1` or `POST /requests/req-1` with `auth == null`.
2. **Unverified Email Write**: `POST /donors/uid1` with `auth.token.email_verified == false`.
3. **Cross-User PII Read**: `GET /donors/victimUid` signed in as `attackerUid`.
4. **Cross-User Identity Spoof**: `POST /requests/req-2` with `requesterId: "victimUid"` signed in as `attackerUid`.
5. **Shadow / Ghost Field Injection**: `POST /donors/uid1` adding `"isAdmin": true` or `"verifiedBadge": true`.
6. **Oversized Document ID Poisoning**: `PUT /requests/${"a".repeat(200)}` (fails `isValidId` `<= 128`).
7. **Invalid Document ID Characters**: `PUT /donors/uid$1/donations/bad.id` (fails `^[a-zA-Z0-9_\\-]+$`).
8. **Client Timestamp Forgery**: `POST /requests/req-3` passing `createdAt: Timestamp(2020-01-01)` instead of `request.time`.
9. **Terminal State Bypass**: `PATCH /requests/req-fulfilled` trying to set `status: "open"` after `status == "fulfilled"`.
10. **Blanket Unfiltered List Attempt**: Listing `/donors` or listing `/requests` where `isPublic == false` and `requesterId != auth.uid`.
11. **Non-Atomic Pledge Inflation**: Updating `/requests/req-1` `unitsPledged` from `0` to `5` without an atomic pledge write, or creating a pledge without incrementing `unitsPledged`.
12. **Type / Bounds Poisoning**: Setting `unitsNeeded: 999` (outside `1..10`) or `bloodType: "X+"` or `notes` > 280 characters.
