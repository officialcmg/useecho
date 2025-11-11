# 🐛 Critical Bug: Inverted `enableScalar` Logic in `createContentRevision`

**Date Discovered:** November 11, 2025  
**Severity:** HIGH  
**Status:** Workaround Implemented  
**SDK Version:** aqua-js-sdk (current version)

---

## 📋 Summary

The `enableScalar` parameter in the `createContentRevisionUtil` function has **inverted logic** compared to all other revision creation methods in the SDK. This causes hash calculation to use the wrong method, leading to verification failures.

---

## 🔍 The Bug

### What Should Happen

The `enableScalar` parameter should control hash calculation:

- **`enableScalar = true` (scalar mode):**  
  Hash = `"0x" + getHashSum(JSON.stringify(verificationData))`  
  Direct SHA256 hash of JSON-serialized data

- **`enableScalar = false` (tree mode):**  
  Hash = `getMerkleRoot(leaves)`  
  Merkle tree root from property hashes  
  Includes `leaves` array in revision

### What Actually Happens in `createContentRevision`

**File:** `src/core/content.ts` (Lines 81-86)

```typescript
let verification_hash = ""
if (!enableScalar) {  // ← BUG: Condition is INVERTED!
  verification_hash = "0x" + getHashSum(JSON.stringify(verificationData))  // Scalar method
  verificationData.leaves = leaves
} else {
  verification_hash = getMerkleRoot(leaves)  // Tree method
}
```

**Result:**
- `enableScalar = true` → Uses Merkle tree method (WRONG!)
- `enableScalar = false` → Uses scalar method (WRONG!)

### Correct Implementation (All Other Revision Types)

**Genesis Revisions** (`src/core/revision.ts` Lines 248-267):
```typescript
if (enableScalar) {  // ✓ CORRECT
  verificationHash = "0x" + getHashSum(stringifiedData)
} else {
  verificationHash = getMerkleRoot(leaves)
}
```

**Signature Revisions** (`src/core/signature.ts` Lines 190-195):
```typescript
if (enableScalar) {  // ✓ CORRECT
  verification_hash = "0x" + getHashSum(JSON.stringify(verificationData))
} else {
  verification_hash = getMerkleRoot(leaves)
  verificationData.leaves = leaves
}
```

**Form, Witness, Link Revisions:** All use the correct logic.

---

## 💥 Impact

### Why Our Genesis Revisions Work

```typescript
createGenesisRevision(fileObject, false, true, false)
//                                      ↑     ↑
//                                enableContent enableScalar

// enableScalar=false → Uses tree mode (Merkle root) ✓
// Hash calculated correctly
// Verification succeeds ✓
```

### Why Our Content Revisions Fail

```typescript
createContentRevision(aquaTreeWrapper, fileObject, true)
//                                                  ↑
//                                            enableScalar

// enableScalar=true → BUG causes Merkle root to be used during creation
// During verification:
//   - SDK detects no "leaves" property → assumes scalar mode
//   - Recalculates hash using scalar method
//   - Hash mismatch! ✗
```

### Error Output

```
✗ Revision 3 (content file): FAILED
  - Error: "Scalar revision verification failed"
  - calculated hash: 0xf1e14545173a7c914b5b71d420ace42...
  - expected hash: 0xde6e705453f30cc1d1efe729c9c678837ef2ba9dc3622788b9f1cbb2a2ab1b7d
```

**The hashes are completely different because:**
1. Creation used Merkle tree hashing (due to bug)
2. Verification used scalar hashing (correct behavior)

---

## ✅ Our Workaround

### Before (Broken)
```typescript
export async function createContentRevision(
  aquafier: Aquafier,
  aquaTree: AquaTree,
  audioBlob: Blob,
  fileName: string,
  prevHash: string
): Promise<Result<AquaOperationData, LogData[]>> {
  const fileContent = await blobToArrayBuffer(audioBlob)
  const fileObject: FileObject = {
    fileName,
    fileContent: new Uint8Array(fileContent),
    path: `/${fileName}`,
  }
  
  return aquafier.createContentRevision(
    { aquaTree, revision: prevHash, fileObject: undefined },
    fileObject,
    true // ✗ FAILS due to SDK bug
  )
}
```

### After (Works)
```typescript
export async function createContentRevision(
  aquafier: Aquafier,
  aquaTree: AquaTree,
  audioBlob: Blob,
  fileName: string,
  prevHash: string
): Promise<Result<AquaOperationData, LogData[]>> {
  const fileContent = await blobToArrayBuffer(audioBlob)
  const fileObject: FileObject = {
    fileName,
    fileContent: new Uint8Array(fileContent),
    path: `/${fileName}`,
  }
  
  // Workaround: Use FALSE to actually get scalar mode (due to inverted logic)
  return aquafier.createContentRevision(
    { aquaTree, revision: prevHash, fileObject: undefined },
    fileObject,
    false // ✓ Works around SDK bug
  )
}
```

**Result:** Both genesis and content revisions now use tree mode (Merkle root), and verification succeeds!

---

## 🔧 Recommended Fix for SDK

**File:** `src/core/content.ts` (Lines 81-86)

**Current (Buggy):**
```typescript
if (!enableScalar) {
  verification_hash = "0x" + getHashSum(JSON.stringify(verificationData))
  verificationData.leaves = leaves
} else {
  verification_hash = getMerkleRoot(leaves)
}
```

**Should Be:**
```typescript
if (enableScalar) {  // ← Remove the "!" negation
  verification_hash = "0x" + getHashSum(JSON.stringify(verificationData))
} else {
  verification_hash = getMerkleRoot(leaves)
  verificationData.leaves = leaves
}
```

---

## 📊 Comparison Table

| Aspect | Genesis Revisions | Content Revisions |
|--------|------------------|-------------------|
| `enableScalar` logic | ✅ Correct | ❌ Inverted |
| `enableScalar=true` behavior | Uses scalar hash ✓ | Uses Merkle root ✗ |
| `enableScalar=false` behavior | Uses Merkle root ✓ | Uses scalar hash ✗ |
| Verification with `enableScalar=true` | ✅ Succeeds | ❌ Fails |
| Verification with `enableScalar=false` | ✅ Succeeds | ✅ Succeeds (with workaround) |

---

## 🎯 Testing

### Steps to Reproduce

1. Create a genesis revision with `enableScalar=true`
2. Create a content revision with `enableScalar=true`
3. Attempt to verify the AquaTree
4. **Expected:** All revisions verify successfully
5. **Actual:** Content revisions fail with "Scalar revision verification failed"

### Verification After Workaround

1. Create genesis revision with `enableScalar=false` (tree mode)
2. Create content revisions with `enableScalar=false` (actually gets scalar mode due to bug, but matches genesis)
3. Verify AquaTree
4. **Result:** ✅ All revisions verify successfully

---

## 📝 Notes

- This bug only affects `createContentRevision`
- All other revision types (genesis, signature, form, witness, link) implement the logic correctly
- The version string at line 76 correctly indicates the intended mode, but the hash calculation contradicts it
- Our workaround uses `enableScalar=false` for both genesis and content revisions to ensure consistency

---

## 🚀 Next Steps

1. ✅ Implement workaround in our codebase
2. 📧 Report bug to Aqua Protocol team
3. ⏳ Wait for SDK fix
4. 🔄 Update our code once SDK is patched

---

**Discovered By:** ECHO Team  
**Contact:** chrismg.eth 
**Repository:** https://github.com/inblockio/aqua-js-sdk
