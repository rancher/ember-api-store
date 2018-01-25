function normalizeType(type) {
  return (type||'').toLowerCase().split('/').get('lastObject');
}

export { normalizeType };
