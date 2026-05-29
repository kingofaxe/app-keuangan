import Swal from 'sweetalert2';

export const swalConfirm = (text = 'Yakin ingin melanjutkan?', title = 'Konfirmasi') =>
  Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Ya, hapus!',
    cancelButtonText: 'Batal',
    borderRadius: '14px',
  });

export const swalSuccess = (text = 'Berhasil!') =>
  Swal.fire({ icon:'success', title:'Berhasil', text, timer:1500, showConfirmButton:false });

export const swalError = (text = 'Terjadi kesalahan') =>
  Swal.fire({ icon:'error', title:'Error', text });
