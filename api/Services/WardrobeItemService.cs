using api.Models;
using api.Repositories;

namespace api.Services
{
    public class WardrobeItemService : IWardrobeItemService
    {


        private readonly IWardrobeItemRepository _wardrobeItemRepository;



        public WardrobeItemService(IWardrobeItemRepository wardrobeItemService)
        {
            _wardrobeItemRepository = wardrobeItemService;
        }


        public async Task<IEnumerable<WardrobeItem>> GetAllAsync()
        {
            return await _wardrobeItemRepository.GetAllAsync();
        }




    }
}
