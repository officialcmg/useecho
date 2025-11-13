# SDK Bug: `[object Object]` in file_index

## Issue
When calling `createContentRevision`, the SDK incorrectly adds `[object Object]` as a key in the `file_index` instead of the verification hash string.

## Root Cause
In `createContentRevisionUtil` (line 1354 in web.cjs):
```javascript
maybeUpdateFileIndex(
  aquaTreeWrapper.aquaTree,
  verificationData,  // ❌ WRONG: This is an object!
  revisionType,
  fileObject.fileName,
  ...
)
```

The function passes `verificationData` (an object) instead of `verification_hash` (a string).

When `maybeUpdateFileIndex` uses this as a key (line 835):
```javascript
aquaTree.file_index[verificationHash] = aquaFileName;
```

JavaScript converts the object to string, resulting in `"[object Object]"`.

## Expected Behavior
The SDK should pass the `verification_hash` string, like `createGenesisRevision` does (line 1836):
```javascript
maybeUpdateFileIndex(
  aquaTree,
  verificationHash,  // ✅ CORRECT: String hash
  revisionType,
  fileObject.fileName,
  ...
)
```

## Workaround
Manually fix the `file_index` after calling `createContentRevision`:
```typescript
const result = await aquafier.createContentRevision(...)
if (isOk(result)) {
  const tree = result.data.aquaTree!
  const finalHash = Object.keys(tree.revisions)[Object.keys(tree.revisions).length - 1]
  
  // Fix SDK bug
  delete tree.file_index['[object Object]']
  tree.file_index[finalHash] = 'filename.ext'
}
```

## Impact
- `file_index` contains invalid key `"[object Object]"`
- External file verification may fail if it relies on `file_index` lookup
- Correct hash mapping is missing from `file_index`
