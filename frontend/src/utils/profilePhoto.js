export function validateProfilePhoto(file) {
  if (!file) return null
  if (!['image/jpeg', 'image/png'].includes(file.type)) return 'JPG 또는 PNG 사진을 선택해 주세요.'
  if (file.size > 2 * 1024 * 1024) return '사진은 2MB 이하로 올려주세요.'
  return null
}

export function readProfilePhoto(file) {
  const message = validateProfilePhoto(file)
  if (message) return Promise.reject(new Error(message))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('사진 파일을 읽지 못했습니다. 다시 선택해 주세요.'))
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
  })
}
